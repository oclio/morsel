import { applyValidation } from '@/load/apply-validation';
import { buildLayers } from '@/load/build-layers';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { resolveOptions } from '@/store/assert-name';
import { toMorselLayer } from '@/store/morsel-layer';
import { createMorselStore } from '@/store/morsel-store';
import { createRemerge } from '@/store/remerge-runner';
import { createStoreState } from '@/store/store-state';
import type { ConfigRecord, MorselStore, WatchOptions } from '@/store/types';
import { collectWatchedFiles, setupWatchers } from '@/store/watcher-setup';
import { releaseWatcher } from '@/watch/watcher-registry';

/**
 * Load config, watch files, and emit key-level events on change.
 *
 * At boot: loads and merges all layers. Throws `MorselError` if the initial
 * load fails (no valid state to fall back on).
 *
 * On `fs.watch` fire: re-merges, emits changes. Errors are caught internally
 * and routed to `onDebug`/stderr — the last valid config is preserved.
 *
 * @param options - Configuration options.
 * @returns A reactive store with `config`, `layers`, `on()`, `stop()`.
 */
export async function watchConfig<T extends ConfigRecord = ConfigRecord>(
  options: WatchOptions<T>,
): Promise<MorselStore<T>> {
  const resolved = resolveOptions(options);
  const globalPath = await resolveGlobalPath(resolved, resolved.formatPlugins);
  const projectPath = await resolveProjectPath(
    resolved,
    resolved.formatPlugins,
  );

  const layers = await buildLayers(resolved, globalPath, projectPath);

  const merged = mergeLayers(layers, resolved.arrayMerge);
  const validated = applyValidation(merged, resolved.validationPlugins);
  const config = applyMutability(validated, resolved.configMutability) as T;
  const morselLayers = layers.map((layer) =>
    toMorselLayer(layer, resolved.name),
  );

  const debounceMs = options.watchDebounce ?? 300;
  const remerge = createRemerge<T>();

  const state = createStoreState<T>(
    config,
    morselLayers,
    projectPath,
    resolved,
    debounceMs,
    remerge,
  );

  collectWatchedFiles(state, layers);

  try {
    setupWatchers(state, layers);
  } catch (error) {
    for (const directory of state.watchers) {
      releaseWatcher(directory, state);
    }
    state.watchers.clear();
    throw error;
  }

  return createMorselStore(state, resolved.configMutability);
}
