import { applyMutability } from '@/load/merge-layers';
import { dotifyObject } from '@/paths/dotify';
import { parsePath } from '@/paths/parse-path';
import { getPathValue } from '@/paths/path-access';
import {
  assertArray,
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/array-ops';
import { stopStore } from '@/store/boot/stop-store';
import { isWildcardPattern } from '@/store/reactive/match-wildcard';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import {
  deleteKey as deleteKeyMutator,
  mutateKey as mutateKeyMutator,
} from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import type {
  ChangeEvent,
  DeleteTarget,
  Listener,
  ListenerOptions,
  MorselLayer,
  MorselStore,
  StoreTarget,
} from '@/store/types';

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
    on(key: string, listener: Listener, options?: ListenerOptions): () => void {
      if (state.stopped) {
        throw new Error('morsel: store is stopped');
      }
      const map = isWildcardPattern(key)
        ? state.wildcardListeners
        : state.listeners;
      let set = map.get(key);
      if (set === undefined) {
        set = new Set();
        map.set(key, set);
      }

      const wrapped = options?.once
        ? (event: ChangeEvent): void => {
            set.delete(wrapped);
            listener(event);
          }
        : listener;

      set.add(wrapped);

      return () => {
        set.delete(wrapped);
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
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.indexOf(value);
    },
    lastIndexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.lastIndexOf(value);
    },
    async stop(): Promise<void> {
      return stopStore(state);
    },
  };

  return store;
}
