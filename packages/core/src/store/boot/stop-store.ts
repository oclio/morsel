import type { StoreState } from '@/store/store-state';
import { releaseWatcher } from '@/watch/watcher-registry';

/**
 * Stop the store: mark stopped, await pending re-merge, clear timers,
 * release watchers, dispose hooks, and clear listeners.
 */
export async function stopStore<T extends Record<string, unknown>>(
  state: StoreState<T>,
): Promise<void> {
  if (state.stopped) {
    return;
  }
  state.stopped = true;

  await state.remergeDone;

  for (const timer of state.debounceTimers.values()) {
    clearTimeout(timer);
  }
  state.debounceTimers.clear();

  for (const directory of state.watchers) {
    releaseWatcher(directory, state);
  }
  state.watchers.clear();

  for (const hook of state.options.hooks) {
    if (hook.dispose === undefined) continue;
    try {
      await hook.dispose();
    } catch (error) {
      state.options.onDebug(
        `hook "${hook.name}" failed in dispose: ${(error as Error).message}`,
        { hookName: hook.name },
      );
    }
  }

  state.listeners.clear();
  state.wildcardListeners.clear();
}
