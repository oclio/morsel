import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { parsePath } from '@/paths/parse-path';
import { hasRemovedPathValue } from '@/paths/path-access';
import { getWritableTargetFile } from '@/store/store-mutation-helpers';
import {
  applyOptimisticUpdate,
  rollbackOptimisticUpdate,
} from '@/store/store-optimistic-update';
import type { StoreState } from '@/store/store-state';
import type { DeleteTarget } from '@/store/types';
import { writeConfigFile } from '@/writer/write-config';

type ConfigRecord = Record<string, unknown>;

/**
 * Delete a key: optimistic removal, persist deletion to disk, rollback
 * on write failure, trigger after:write hooks per file.
 */
export async function doDeleteKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: DeleteTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<boolean> {
  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');

  const targetFiles: string[] = [];
  if (target === 'global' || target === 'project') {
    targetFiles.push(getWritableTargetFile(dottedPath, state, target));
  } else {
    for (const layer of state._layers) {
      if (
        (layer.source === 'project' || layer.source === 'global') &&
        layer.path !== undefined
      ) {
        targetFiles.push(layer.path);
      }
    }
  }

  const previousLayers = state._layers;
  const previousConfig = state._config;
  const previousLastConfig = state.lastConfig;

  const didChange = applyOptimisticUpdate(
    state,
    mutability,
    targetFiles,
    (layerConfig) => {
      return hasRemovedPathValue(layerConfig, segments);
    },
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
