import { MorselError } from '@/errors/error';
import { createHookContext } from '@/hooks/hook-context';
import type { Hook, HookContext } from '@/hooks/types';
import { resolveOptions } from '@/store/boot/assert-name';
import { loadPipeline } from '@/store/boot/load-config';
import { createRemerge } from '@/store/reactive/remerge-runner';
import {
  collectWatchedFiles,
  setupWatchers,
} from '@/store/reactive/watcher-setup';
import { createReactiveMorselStore } from '@/store/store';
import type { StoreState } from '@/store/store-state';
import { createStoreState } from '@/store/store-state';
import type {
  ConfigRecord,
  MorselReactiveStore,
  ReactiveStoreOptions,
} from '@/store/types';
import { releaseWatcher } from '@/watch/watcher-registry';

function releaseAllWatchers<T extends ConfigRecord>(
  state: StoreState<T>,
): void {
  for (const directory of state.watchers) {
    releaseWatcher(directory, state);
  }
  state.watchers.clear();
}

/**
 * Initialize stateful hooks (`init` lifecycle). Releases watchers and throws
 * `MorselError` (`EHOOK`) if any hook fails — the store is not returned.
 */
async function initHooks<T extends ConfigRecord>(
  state: StoreState<T>,
  hooks: readonly Hook[],
  context: HookContext,
): Promise<void> {
  for (const hook of hooks) {
    if (hook.init === undefined) continue;
    try {
      await hook.init(context);
    } catch (error) {
      releaseAllWatchers(state);
      throw new MorselError(
        undefined,
        'EHOOK',
        new Error(
          `hook "${hook.name}" failed in init: ${(error as Error).message}`,
        ),
      );
    }
  }
}

/**
 * Create a reactive configuration store with watchers, events, and re-merge.
 *
 * At boot: loads and merges all layers. Throws `MorselError` if the initial
 * load fails (no valid state to fall back on).
 *
 * On `fs.watch` fire: re-merges, emits changes. Errors are caught internally
 * and routed to `onDebug`/stderr — the last valid config is preserved.
 *
 * @param options - Configuration options.
 * @returns A reactive store with `config`, `layers`, `on`, `off`, `triggerRemerge`, `stop`.
 */
export async function createReactiveStore<
  T extends ConfigRecord = ConfigRecord,
>(options: ReactiveStoreOptions<T>): Promise<MorselReactiveStore<T>> {
  const resolved = resolveOptions(options);

  const remerge = createRemerge<T>();

  const stateReference_: { current?: StoreState<T> } = {};
  const triggerRemerge = () => {
    if (stateReference_.current !== undefined) {
      void remerge(stateReference_.current);
    }
  };

  const { config, layers, morselLayers, projectPath } = await loadPipeline<T>(
    resolved,
    triggerRemerge,
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
  stateReference_.current = state;

  collectWatchedFiles(state, layers);

  /**
   * Defensive try/catch: if setupWatchers throws, release all watchers
   * already created and rethrow. Not testable in e2e because
   * setupWatchers catches fs.watch errors internally via startRecovery
   * and never throws in real conditions. Covered by unit test in
   * create-reactive-store.spec.ts \> "releases all watchers and rethrows".
   */
  try {
    setupWatchers(state, layers);
  } catch (error) {
    releaseAllWatchers(state);
    throw error;
  }

  const store = createReactiveMorselStore(
    state,
    resolved.configMutability,
    triggerRemerge,
  );

  const initContext = createHookContext(resolved, triggerRemerge);
  await initHooks(state, resolved.hooks, initContext);

  if (options.signal !== undefined) {
    const signal = options.signal;
    if (signal.aborted) {
      await store.stop();
    } else {
      signal.addEventListener('abort', () => {
        void store.stop();
      });
    }
  }

  return store;
}
