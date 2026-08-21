import { applyMutability } from '@/load/merge-layers';
import { createStableProxy } from '@/store/stable-proxy';
import type { StoreState } from '@/store/store-state';
import type { Listener, MorselLayer, MorselStore } from '@/store/types';
import { releaseWatcher } from '@/watch/watcher-registry';

type ConfigRecord = Record<string, unknown>;

/**
 * Create a {@link MorselStore} from internal state and a mutability mode.
 * The store exposes `config`, `layers`, `on`, and `stop` to consumers.
 */
export function createMorselStore<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
): MorselStore<T> {
  const proxy = createStableProxy(state, mutability);
  state._proxy = proxy;

  const store: MorselStore<T> = {
    get config(): T {
      if (state.stopped) {
        state._stoppedConfig ??= applyMutability(state._config, mutability);
        return state._stoppedConfig;
      }
      return mutability === 'mutable' ? state._config : proxy;
    },
    get layers(): MorselLayer[] {
      return [...state._layers];
    },
    on(key: string, listener: Listener): () => void {
      if (state.stopped) {
        throw new Error('morsel: store is stopped');
      }
      let set = state.listeners.get(key);
      if (set === undefined) {
        set = new Set();
        state.listeners.set(key, set);
      }
      set.add(listener);

      return () => {
        set.delete(listener);
      };
    },
    async stop(): Promise<void> {
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
      state.listeners.clear();
    },
  };

  return store;
}
