import { applyMutability } from '@/load/merge-layers';
import { dotifyObject } from '@/paths/dotify';
import { getPathValue } from '@/paths/path-access';
import { stopStore } from '@/store/boot/stop-store';
import { isWildcardPattern } from '@/store/reactive/match-wildcard';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import { resolveProvenance } from '@/store/store-provenance';
import type { StoreState } from '@/store/store-state';
import type {
  ChangeEvent,
  Listener,
  ListenerOptions,
  MorselLayer,
  MorselReactiveStore,
  MorselStore,
  Provenance,
} from '@/store/types';
import { deepClone } from '@/utils/deep-clone';

type ConfigRecord = Record<string, unknown>;

/**
 * Shared read methods used by both static and reactive stores.
 * Getters (`config`, `layers`) are defined by each factory since they differ.
 */
function createBaseMethods<T extends ConfigRecord>(
  state: StoreState<T>,
): Pick<MorselStore<T>, 'get' | 'has' | 'all' | 'dotify' | 'getProvenance'> {
  return {
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
    getProvenance(
      pathInput: string | readonly (string | number)[],
    ): Provenance | undefined {
      return resolveProvenance(state._layers, pathInput);
    },
  };
}

/**
 * Create a static {@link MorselStore} — no watchers, no events, no proxy.
 * Exposes `config`, `layers`, `get`, `has`, `all`, `dotify`, `getProvenance`, and `stop`.
 */
export function createStaticMorselStore<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
): MorselStore<T> {
  return {
    ...createBaseMethods(state),
    get config(): T {
      if (state.stopped) {
        state._stoppedConfig ??= applyMutability(state._config, mutability);
        return state._stoppedConfig;
      }
      return state._config;
    },
    get layers(): MorselLayer[] {
      return [...state._layers];
    },
    async stop(): Promise<void> {
      state.stopped = true;
    },
  };
}

/**
 * Create a {@link MorselReactiveStore} — watchers, events, proxy, re-merge.
 * Extends the static store methods with `on`, `off`, `triggerRemerge`,
 * a stable proxy on `config`, and real `stop`.
 */
export function createReactiveMorselStore<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
  triggerRemerge: () => void,
): MorselReactiveStore<T> {
  const proxy = createStableProxy(state, mutability);
  state._proxy = proxy;

  return {
    ...createBaseMethods(state),
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
    off(key: string, listener: Listener): void {
      if (state.stopped) {
        throw new Error('morsel: store is stopped');
      }
      const map = isWildcardPattern(key)
        ? state.wildcardListeners
        : state.listeners;
      const set = map.get(key);
      if (set !== undefined) {
        set.delete(listener);
        if (set.size === 0) {
          map.delete(key);
        }
      }
    },
    triggerRemerge,
    async stop(): Promise<void> {
      return stopStore(state);
    },
  };
}
