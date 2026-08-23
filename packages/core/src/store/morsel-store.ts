import { applyMutability } from '@/load/merge-layers';
import { dotifyObject } from '@/paths/dotify';
import { getPathValue } from '@/paths/path-access';
import { createStableProxy } from '@/store/stable-proxy';
import {
  deleteKey as deleteKeyMutator,
  mutateKey as mutateKeyMutator,
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import type {
  DeleteTarget,
  Listener,
  MorselLayer,
  MorselStore,
  StoreTarget,
} from '@/store/types';
import { releaseWatcher } from '@/watch/watcher-registry';

type ConfigRecord = Record<string, unknown>;

/**
 * Create a {@link MorselStore} from internal state and a mutability mode.
 * The store exposes `config`, `layers`, `on`, `get`, `set`, `has`, `unset`, `all`, `dotify`, `push`, `unshift`, `pop`, `shift`, `splice`, `indexOf`, `lastIndexOf`, and `stop`.
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
    get<V = unknown>(
      pathInput: string | readonly (string | number)[],
      defaultValue?: V,
    ): V {
      const value = getPathValue(state._config, pathInput);
      if (value === undefined) {
        return defaultValue as V;
      }
      return value as V;
    },
    has(pathInput: string | readonly (string | number)[]): boolean {
      return getPathValue(state._config, pathInput) !== undefined;
    },
    async set(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<void> {
      return store.mutateKey(pathInput, value, target);
    },
    async unset(
      pathInput: string | readonly (string | number)[],
      target?: DeleteTarget,
    ): Promise<boolean> {
      return store.deleteKey(pathInput, target);
    },
    all(): T {
      return deepCloneConfig(state._config) as T;
    },
    dotify(): Record<string, unknown> {
      return dotifyObject(state._config);
    },
    async mutateKey(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<void> {
      return mutateKeyMutator(state, pathInput, value, target, mutability);
    },
    async deleteKey(
      pathInput: string | readonly (string | number)[],
      target?: DeleteTarget,
    ): Promise<boolean> {
      return deleteKeyMutator(state, pathInput, target, mutability);
    },
    async push(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<number> {
      return pushKey(state, pathInput, value, target, mutability);
    },
    async unshift(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<number> {
      return unshiftKey(state, pathInput, value, target, mutability);
    },
    async pop(
      pathInput: string | readonly (string | number)[],
      target?: StoreTarget,
    ): Promise<unknown> {
      return popKey(state, pathInput, target, mutability);
    },
    async shift(
      pathInput: string | readonly (string | number)[],
      target?: StoreTarget,
    ): Promise<unknown> {
      return shiftKey(state, pathInput, target, mutability);
    },
    async splice(
      pathInput: string | readonly (string | number)[],
      start: number,
      deleteCount: number,
      ...items: unknown[]
    ): Promise<unknown[]> {
      return spliceKey(
        state,
        pathInput,
        start,
        deleteCount,
        items,
        undefined,
        mutability,
      );
    },
    indexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = getPathValue(state._config, pathInput);
      return Array.isArray(array) ? array.indexOf(value) : -1;
    },
    lastIndexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = getPathValue(state._config, pathInput);
      return Array.isArray(array) ? array.lastIndexOf(value) : -1;
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
