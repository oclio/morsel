import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { parsePath } from '@/paths/parse-path';
import { setPathValue } from '@/paths/path-access';
import { getWritableTargetFile } from '@/store/store-mutation-helpers';
import {
  applyOptimisticUpdate,
  applyOptimisticUpdateSilent,
  rollbackOptimisticUpdate,
} from '@/store/store-optimistic-update';
import type { StoreState } from '@/store/store-state';
import { trackDirtyKey } from '@/store/store-transaction';
import type { StoreTarget } from '@/store/types';
import { writeConfigFile } from '@/writer/write-config';

type ConfigRecord = Record<string, unknown>;

/**
 * Set a key by path: optimistic update, persist to source file, rollback
 * on write failure, trigger after:write hooks.
 *
 * During a transaction (`state.inTransaction === true`), the optimistic
 * update is applied silently (no events), the write is skipped, and the
 * dirty key is tracked for commit.
 */
export async function doMutateKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<void> {
  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');
  const targetFilePath = getWritableTargetFile(dottedPath, state, target);

  if (state.inTransaction) {
    applyOptimisticUpdateSilent(
      state,
      mutability,
      [targetFilePath],
      (layerConfig) => {
        setPathValue(layerConfig, segments, value);
        return true;
      },
    );
    trackDirtyKey(state, targetFilePath, dottedPath);
    return;
  }

  const previousLayers = state._layers;
  const previousConfig = state._config;
  const previousLastConfig = state.lastConfig;

  const didChange = applyOptimisticUpdate(
    state,
    mutability,
    [targetFilePath],
    (layerConfig) => {
      setPathValue(layerConfig, segments, value);
      return true; // setPathValue always mutates
    },
  );

  if (!didChange) {
    return;
  }

  const mutatedConfig = state._config;
  const mutation = { path: dottedPath, value };
  try {
    await writeConfigFile(
      targetFilePath,
      mutation,
      state.options.formatPlugins,
    );
  } catch (error) {
    rollbackOptimisticUpdate(
      state,
      previousLayers,
      previousConfig,
      previousLastConfig,
      mutatedConfig,
    );
    throw error;
  }

  const writeEvent: WriteEvent = {
    filePath: targetFilePath,
    keyPath: dottedPath,
    mutation,
  };
  await runWriteHooks(state.options.hooks, writeEvent, state.options.onDebug);
}
