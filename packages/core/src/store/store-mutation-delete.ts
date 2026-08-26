import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { parsePath } from '@/paths/parse-path';
import { hasRemovedPathValue } from '@/paths/path-access';
import { getWritableTargetFile } from '@/store/store-mutation-helpers';
import {
  applyOptimisticUpdate,
  applyOptimisticUpdateSilent,
  rollbackOptimisticUpdate,
} from '@/store/store-optimistic-update';
import type { StoreState } from '@/store/store-state';
import { trackDirtyKey } from '@/store/store-transaction';
import type { DeleteTarget } from '@/store/types';
import { writeConfigFile } from '@/writer/write-config';

type ConfigRecord = Record<string, unknown>;

function collectDeleteTargetFiles<T extends ConfigRecord>(
  state: StoreState<T>,
  dottedPath: string,
  target: DeleteTarget | undefined,
): string[] {
  if (target === 'global' || target === 'project') {
    return [getWritableTargetFile(dottedPath, state, target)];
  }
  return state._layers
    .filter(
      (layer) =>
        (layer.source === 'project' || layer.source === 'global') &&
        layer.path !== undefined,
    )
    .map((layer) => layer.path as string);
}

/**
 * Delete a key: optimistic removal, persist deletion to disk, rollback
 * on write failure, trigger after:write hooks per file.
 *
 * During a transaction (`state.inTransaction === true`), the optimistic
 * update is applied silently (no events), the write is skipped, and the
 * dirty key is tracked for commit.
 */
export async function doDeleteKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: DeleteTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<boolean> {
  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');
  const targetFiles = collectDeleteTargetFiles(state, dottedPath, target);

  if (state.inTransaction) {
    const didChange = applyOptimisticUpdateSilent(
      state,
      mutability,
      targetFiles,
      (layerConfig) => hasRemovedPathValue(layerConfig, segments),
    );
    if (didChange) {
      for (const file of targetFiles) {
        trackDirtyKey(state, file, dottedPath);
      }
    }
    return didChange;
  }

  const previousLayers = state._layers;
  const previousConfig = state._config;
  const previousLastConfig = state.lastConfig;

  const didChange = applyOptimisticUpdate(
    state,
    mutability,
    targetFiles,
    (layerConfig) => hasRemovedPathValue(layerConfig, segments),
  );

  if (!didChange) {
    return false;
  }

  const mutatedConfig = state._config;
  const deleteMutation = { isDelete: true, path: dottedPath } as const;
  try {
    for (const file of targetFiles) {
      await writeConfigFile(file, deleteMutation, state.options.formatPlugins);
    }
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

  for (const file of targetFiles) {
    const writeEvent: WriteEvent = {
      filePath: file,
      keyPath: dottedPath,
      mutation: deleteMutation,
    };
    await runWriteHooks(state.options.hooks, writeEvent, state.options.onDebug);
  }

  return true;
}
