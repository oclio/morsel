import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
import { parsePath } from '@/paths/parse-path';
import { hasRemovedPathValue, setPathValue } from '@/paths/path-access';
import { emitChanges } from '@/store/reactive/emit-changes';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import type { DeleteTarget, MorselLayer, StoreTarget } from '@/store/types';
import { resolveKeyOrigin } from '@/writer/resolve-origin';
import { writeConfigFile } from '@/writer/write-config';

type ConfigRecord = Record<string, unknown>;

function getWritableTargetFile(
  pathKey: string,
  state: StoreState,
  target?: StoreTarget,
): string {
  const origin = resolveKeyOrigin(pathKey, state._layers, target);
  if (origin.isWritable && origin.filePath !== undefined) {
    return origin.filePath;
  }

  if (state.projectPath !== undefined) {
    return state.projectPath;
  }

  throw new Error(`morsel: cannot write "${pathKey}" — no writable file found`);
}

/**
 * Update the targeted layer in memory, re-merge the entire cascade,
 * apply validation and mutability, update the store state, and emit changes.
 * Returns the new merged config or false if no layers were actually changed.
 */
function applyOptimisticUpdate<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
  targetFiles: string[],
  mutation: (layerConfig: ConfigRecord) => boolean,
): boolean {
  let anyLayerChanged = false;
  const newLayers = state._layers.map((layer) => {
    if (targetFiles.includes(layer.path as string)) {
      const clonedConfig = deepCloneConfig(layer.config);
      const changed = mutation(clonedConfig);
      if (changed) {
        anyLayerChanged = true;
        return {
          ...layer,
          config: clonedConfig,
        } as MorselLayer;
      }
    }
    return layer;
  });

  if (!anyLayerChanged) {
    return false;
  }

  const merged = mergeLayers(
    newLayers as unknown as import('@/load/resolve-layer').ResolvedLayer[],
    state.options.arrayMerge,
  );
  const interpolated = interpolate(merged);
  const validated = applyValidation(
    interpolated,
    state.options.validationPlugins,
  );
  const newConfig = applyMutability(validated, mutability) as T;
  const newLastConfig =
    mutability === 'mutable' ? deepCloneConfig(validated) : validated;

  const previousSnapshot = state._config;

  state._layers = newLayers;
  state._config = newConfig;
  state.lastConfig = newLastConfig;

  emitChanges(
    previousSnapshot,
    validated,
    state.listeners,
    state.wildcardListeners,
  );

  return true;
}

/**
 * Rollback the store state after a failed optimistic update.
 * If a concurrent re-merge replaced `state._config` while we were awaiting write,
 * we skip the rollback to preserve the newer real state.
 */
function rollbackOptimisticUpdate<T extends ConfigRecord>(
  state: StoreState<T>,
  previousLayers: MorselLayer[],
  previousConfig: T,
  previousLastConfig: ConfigRecord,
  mutatedConfig: T,
): void {
  if (state._config !== mutatedConfig) {
    return; // Config changed during await (e.g. concurrent re-merge), skip rollback
  }
  const revertedSnapshot = state._config;
  state._layers = previousLayers;
  state._config = previousConfig;
  state.lastConfig = previousLastConfig;

  emitChanges(
    revertedSnapshot,
    previousLastConfig,
    state.listeners,
    state.wildcardListeners,
  );
}
export async function mutateKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<void> {
  if (state.stopped) {
    throw new Error('morsel: store is stopped');
  }

  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');
  const targetFilePath = getWritableTargetFile(dottedPath, state, target);

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

/**
 * Optimistically delete a key from the store: clone, remove, apply mutability,
 * emit changes, then persist deletion to disk. Rollback on write failure.
 */
export async function deleteKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: DeleteTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<boolean> {
  if (state.stopped) {
    throw new Error('morsel: store is stopped');
  }

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
