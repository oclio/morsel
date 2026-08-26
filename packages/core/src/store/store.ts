import { applyMutability } from '@/load/merge-layers';
import { dotifyObject } from '@/paths/dotify';
import { getPathValue } from '@/paths/path-access';
import { stopStore } from '@/store/boot/stop-store';
import { isWildcardPattern } from '@/store/reactive/match-wildcard';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import { createArrayMethods } from '@/store/store-array-methods';
import {
  deleteKey as deleteKeyMutator,
  mutateKey as mutateKeyMutator,
  setKey,
  unsetKey,
} from '@/store/store-mutator';
import { resolveProvenance } from '@/store/store-provenance';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import { runTransaction } from '@/store/store-transaction';
import type {
  ChangeEvent,
  DeleteTarget,
  Listener,
  ListenerOptions,
  MorselLayer,
  MorselStore,
  Provenance,
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
  const proxy = state.options.proxy
    ? createStableProxy(state, mutability)
    : undefined;
  state._proxy = proxy;

  const arrayMethods = createArrayMethods(state, mutability);

  const store: MorselStore<T> = {
    get config(): T {
      if (state.stopped) {
        state._stoppedConfig ??= applyMutability(state._config, mutability);
        return state._stoppedConfig;
      }
      if (proxy === undefined) {
        return state._config;
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
      return setKey(state, pathInput, value, target, mutability);
    },
    async unset(
      pathInput: string | readonly (string | number)[],
      target?: DeleteTarget,
    ): Promise<boolean> {
      return unsetKey(state, pathInput, target, mutability);
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
    push: arrayMethods.push,
    unshift: arrayMethods.unshift,
    pop: arrayMethods.pop,
    shift: arrayMethods.shift,
    splice: arrayMethods.splice,
    indexOf: arrayMethods.indexOf,
    lastIndexOf: arrayMethods.lastIndexOf,
    async stop(): Promise<void> {
      return stopStore(state);
    },
    getProvenance(
      pathInput: string | readonly (string | number)[],
    ): Provenance | undefined {
      return resolveProvenance(state._layers, pathInput);
    },
    async transaction(callback: () => Promise<void>): Promise<void> {
      return runTransaction(state, mutability, callback);
    },
  };

  return store;
}
