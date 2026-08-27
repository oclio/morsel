import { processConfig } from '@/load/process-config';
import { emitChanges } from '@/store/reactive/emit-changes';
import type { StoreState } from '@/store/store-state';
import type { MorselLayer } from '@/store/types';
import { deepClone } from '@/utils/deep-clone';

type ConfigRecord = Record<string, unknown>;

/**
 * Map over the store's layers, applying a mutation to those matching
 * `targetFiles`. Returns `{ layers, changed }` — `changed` is false if no
 * layer was actually modified.
 */
function mutateLayers(
  layers: readonly MorselLayer[],
  targetFiles: string[],
  mutation: (layerConfig: ConfigRecord) => boolean,
): { layers: MorselLayer[]; changed: boolean } {
  let changed = false;
  const newLayers = layers.map((layer) => {
    if (targetFiles.includes(layer.path as string)) {
      const clonedConfig = deepClone(layer.config);
      const isChanged = mutation(clonedConfig);
      if (isChanged) {
        changed = true;
        return { ...layer, config: clonedConfig } as MorselLayer;
      }
    }
    return layer;
  });
  return { layers: newLayers, changed };
}

/**
 * Update the targeted layer in memory, re-merge the entire cascade,
 * apply validation and mutability, update the store state. Does NOT emit
 * change events — used during transactions where events are deferred to commit.
 * Returns true if any layer was changed, false otherwise.
 */
export function applyOptimisticUpdateSilent<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
  targetFiles: string[],
  mutation: (layerConfig: ConfigRecord) => boolean,
): boolean {
  const { layers: newLayers, changed } = mutateLayers(
    state._layers,
    targetFiles,
    mutation,
  );
  if (!changed) {
    return false;
  }

  const { config, lastConfig } = processConfig<T>(
    newLayers as unknown as import('@/load/resolve-layer').ResolvedLayer[],
    state.options.arrayMerge,
    state.options.validationPlugins,
    mutability,
  );

  state._layers = newLayers;
  state._config = config;
  state.lastConfig = lastConfig;

  return true;
}

/**
 * Update the targeted layer in memory, re-merge the entire cascade,
 * apply validation and mutability, update the store state, and emit changes.
 * Returns the new merged config or false if no layers were actually changed.
 */
export function applyOptimisticUpdate<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
  targetFiles: string[],
  mutation: (layerConfig: ConfigRecord) => boolean,
): boolean {
  const { layers: newLayers, changed } = mutateLayers(
    state._layers,
    targetFiles,
    mutation,
  );
  if (!changed) {
    return false;
  }

  const { config, validated, lastConfig } = processConfig<T>(
    newLayers as unknown as import('@/load/resolve-layer').ResolvedLayer[],
    state.options.arrayMerge,
    state.options.validationPlugins,
    mutability,
  );

  const previousSnapshot = state._config;

  state._layers = newLayers;
  state._config = config;
  state.lastConfig = lastConfig;

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
export function rollbackOptimisticUpdate<T extends ConfigRecord>(
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
