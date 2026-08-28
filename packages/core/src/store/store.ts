import { applyMutability } from '@/load/merge-layers';
import { dotifyObject } from '@/paths/dotify';
import { getPathValue } from '@/paths/path-access';
import { stopStore } from '@/store/boot/stop-store';
import { isWildcardPattern } from '@/store/reactive/match-wildcard';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import { createArrayMethods } from '@/store/store-array-methods';
import { resolveProvenance } from '@/store/store-provenance';
import type { StoreState } from '@/store/store-state';
import type {
  ChangeEvent,
  Listener,
  ListenerOptions,
  MorselLayer,
  MorselStore,
  Provenance,
} from '@/store/types';
import { deepClone } from '@/utils/deep-clone';

type ConfigRecord = Record<string, unknown>;

/**
 * Create a {@link MorselStore} from internal state and a mutability mode.
 * The store exposes `config`, `layers`, `on`, `get`, `has`, `all`, `dotify`, `getProvenance`, and `stop`.
 */
export function createMorselStore<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
): MorselStore<T> {
  const proxy = state.options.proxy
    ? createStableProxy(state, mutability)
    : undefined;
  state._proxy = proxy;

  const arrayMethods = createArrayMethods(state);

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
            if (set.size === 0) {
              map.delete(key);
            }
            listener(event);
          }
        : listener;

      set.add(wrapped);

      return () => {
        set.delete(wrapped);
        if (set.size === 0) {
          map.delete(key);
        }
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
    all(): T {
      return deepClone(state._config) as T;
    },
    dotify(): Record<string, unknown> {
      return dotifyObject(state._config);
    },
    async stop(): Promise<void> {
      return stopStore(state);
    },
    getProvenance(
      pathInput: string | readonly (string | number)[],
    ): Provenance | undefined {
      return resolveProvenance(state._layers, pathInput);
    },
    indexOf: arrayMethods.indexOf,
    lastIndexOf: arrayMethods.lastIndexOf,
  };

  return store;
}
