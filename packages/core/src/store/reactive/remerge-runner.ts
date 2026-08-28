import { MorselError } from '@/errors/error';
import { buildLayers } from '@/load/build-layers';
import { processConfig } from '@/load/process-config';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { noop } from '@/store/boot/assert-name';
import { toMorselLayer } from '@/store/layer';
import { emitChanges } from '@/store/reactive/emit-changes';
import {
  updateWatchedFiles,
  updateWatchers,
} from '@/store/reactive/watcher-setup';
import type { StoreState } from '@/store/store-state';

type ConfigRecord = Record<string, unknown>;

/**
 * Check if a file layer that was previously valid has disappeared (ENOENT).
 * If so, log once per source via onDebug and return true to signal that the
 * re-merge should keep the last valid config instead of merging with the
 * remaining layers. Resets ENOENT tracking when all files reappear.
 */
function hasDisappearedLayers(
  newLayers: readonly ResolvedLayer[],
  store: StoreState,
): boolean {
  const disappeared = newLayers.filter(
    (layer) =>
      (layer.source === 'global' || layer.source === 'project') &&
      store._layers.find((old) => old.source === layer.source)?.exists ===
        true &&
      !layer.exists,
  );

  if (disappeared.length === 0) {
    store.enoentLogged.clear();
    return false;
  }

  const newDisappearances = disappeared.filter(
    (layer) => !store.enoentLogged.has(layer.source),
  );

  if (newDisappearances.length > 0) {
    const message = 'morsel: file disappeared — keeping last valid config';
    const context: Record<string, unknown> = {
      code: 'ENOENT',
      sources: newDisappearances.map((layer) => layer.source),
    };

    if (store.options.onDebug === noop) {
      console.error(`${message} — ${JSON.stringify(context)}`);
    } else {
      store.options.onDebug(message, context);
    }

    for (const layer of newDisappearances) {
      store.enoentLogged.add(layer.source);
    }
  }

  return true;
}

/**
 * Create the re-merge function used by the store to re-resolve layers and
 * emit changes on `fs.watch` fire. Extracted from `watch-config` to keep
 * the boot pipeline under the line budget.
 *
 * @returns A re-merge function bound to the generic type T.
 */
export function createRemerge<T extends ConfigRecord>(): (
  store: StoreState,
) => Promise<void> {
  async function remerge(store: StoreState): Promise<void> {
    if (store.stopped) {
      return;
    }
    if (store.remergeInProgress) {
      store.pendingRemerge = true;
      return;
    }
    store.remergeInProgress = true;
    const { promise, resolve: resolveRemergeDone } =
      Promise.withResolvers<undefined>();
    const remergeDone = promise;
    store.remergeDone = remergeDone;

    try {
      const options_ = store.options;
      const remergeGlobalPath = await resolveGlobalPath(
        options_,
        options_.formatPlugins,
      );
      const remergeProjectPath = await resolveProjectPath(
        options_,
        options_.formatPlugins,
      );

      const newLayers: ResolvedLayer[] = await buildLayers(
        options_,
        remergeGlobalPath,
        remergeProjectPath,
        () => void remerge(store),
      );

      if (hasDisappearedLayers(newLayers, store)) {
        return;
      }

      const oldConfig = store.lastConfig;

      const {
        config: newStoreConfig,
        validated,
        lastConfig: newLastConfig,
      } = processConfig<T>(
        newLayers,
        options_.arrayMerge,
        options_.validationPlugins,
        options_.configMutability,
      );
      const newMorselLayers = newLayers.map((layer) => toMorselLayer(layer));

      // Apply config state first — watchers update only after re-merge success (spec §2.2).
      store.lastConfig = newLastConfig;
      store._config = newStoreConfig;
      store._layers = newMorselLayers;
      store.projectPath = remergeProjectPath;

      // Update watchers after config state is applied.
      // Save old watcher state for rollback if updateWatchers throws.
      const savedWatchedFiles = new Map(store.watchedFiles);
      const savedWatchers = new Set(store.watchers);
      try {
        updateWatchedFiles(store, newLayers);
        updateWatchers(store, newLayers);
      } catch (watcherError) {
        store.watchedFiles = savedWatchedFiles;
        store.watchers = savedWatchers;
        throw watcherError;
      }

      emitChanges(
        oldConfig,
        validated,
        store.listeners,
        store.wildcardListeners,
      );
    } catch (error) {
      const message = `morsel: re-merge failed — keeping last valid config`;
      const context: Record<string, unknown> = { error: String(error) };
      if (error instanceof MorselError) {
        context['code'] = error.code;
        context['path'] = error.path;
      }
      const formatted = `${message} — ${String(error)}`;
      if (store.options.onDebug === noop) {
        console.error(formatted);
      } else {
        store.options.onDebug(message, context);
      }
    } finally {
      store.remergeInProgress = false;
      resolveRemergeDone(undefined);
      store.remergeDone = undefined;

      if (store.pendingRemerge) {
        store.pendingRemerge = false;
        void remerge(store);
      }
    }
  }

  return remerge;
}
