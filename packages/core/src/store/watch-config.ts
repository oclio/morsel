import { MorselError } from '@/errors/error';
import { createHookContext } from '@/hooks/hook-context';
import { applyValidation } from '@/load/apply-validation';
import { buildLayers } from '@/load/build-layers';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { resolveOptions } from '@/store/assert-name';
import { toMorselLayer } from '@/store/layer';
import { createRemerge } from '@/store/remerge-runner';
import { createMorselStore } from '@/store/store';
import type { StoreState } from '@/store/store-state';
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

  const remerge = createRemerge<T>();

  let stateReference: StoreState<T> | undefined;
  const triggerRemerge = () => {
    if (stateReference !== undefined) {
      void remerge(stateReference);
    }
  };

  const layers = await buildLayers(
    resolved,
    globalPath,
    projectPath,
    triggerRemerge,
  );

  const merged = mergeLayers(layers, resolved.arrayMerge);
  const interpolated = interpolate(merged);
  const validated = applyValidation(interpolated, resolved.validationPlugins);
  const config = applyMutability(validated, resolved.configMutability) as T;
  const morselLayers = layers.map((layer) =>
    toMorselLayer(layer, resolved.name),
  );

  const debounceMs = options.watchDebounce ?? 300;

  const state = createStoreState<T>(
    config,
    morselLayers,
    projectPath,
    resolved,
    debounceMs,
    remerge,
  );
  stateReference = state;

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

  const store = createMorselStore(state, resolved.configMutability);

  const initContext = createHookContext(resolved, triggerRemerge);
  for (const hook of resolved.hooks) {
    if (hook.lifecycle === 'after:write') continue;
    if (hook.init === undefined) continue;
    try {
      await hook.init(initContext);
    } catch (error) {
      throw new MorselError(
        undefined,
        'EHOOK',
        new Error(
          `hook "${hook.name}" failed in init: ${(error as Error).message}`,
        ),
      );
    }
  }

  return store;
}
