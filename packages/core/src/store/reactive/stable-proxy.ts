import type { ConfigMutability } from '@/load/merge-layers';
import type { StoreState } from '@/store/store-state';

type ConfigRecord = Record<string, unknown>;

/**
 * Create a stable Proxy that always reads from `state._config`, even after
 * config swaps during live-reload. Nested objects are wrapped lazily and
 * cached via WeakMap. Set and delete are blocked in frozen mode.
 */
export function createStableProxy<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: ConfigMutability,
): T {
  const proxyCache = new WeakMap<object, object>();

  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property === 'symbol') {
        return Reflect.get(state._config, property);
      }
      const value = Reflect.get(state._config, property);
      if (typeof value === 'object' && value !== null) {
        return wrapReadOnlyPath(state, [property], mutability, proxyCache);
      }
      return value;
    },
    has(_target, property) {
      return Reflect.has(state._config, property);
    },
    ownKeys() {
      return Reflect.ownKeys(state._config);
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(
        state._config,
        property,
      );
      if (descriptor !== undefined) {
        descriptor.configurable = true;
      }
      return descriptor;
    },
    set(_target, property, value) {
      return shouldSet(state._config, property, value, mutability);
    },
    deleteProperty(_target, property) {
      return shouldDelete(state._config, property, mutability);
    },
  });
}

function wrapReadOnlyPath<T extends ConfigRecord>(
  state: StoreState<T>,
  path: string[],
  mutability: ConfigMutability,
  proxyCache: WeakMap<object, object>,
): object {
  const current = resolvePath(state._config, path);
  const cached = proxyCache.get(current);
  if (cached !== undefined) {
    return cached;
  }

  const proxyTarget: object = Array.isArray(current) ? [] : {};
  const proxy = new Proxy(proxyTarget, {
    get(_target, property) {
      if (typeof property === 'symbol') {
        const target = resolvePath(state._config, path);
        return Reflect.get(target, property);
      }
      const target = resolvePath(state._config, path);
      const value = Reflect.get(target, property);
      if (typeof value === 'object' && value !== null) {
        return wrapReadOnlyPath(
          state,
          [...path, String(property)],
          mutability,
          proxyCache,
        );
      }
      return value;
    },
    has(_target, property) {
      const target = resolvePath(state._config, path);
      return Reflect.has(target, property);
    },
    ownKeys() {
      const target = resolvePath(state._config, path);
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_target, property) {
      if (property === 'length' && Array.isArray(_target)) {
        return Object.getOwnPropertyDescriptor(_target, property);
      }
      const target = resolvePath(state._config, path);
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      if (descriptor !== undefined) {
        descriptor.configurable = true;
      }
      return descriptor;
    },
    set(_target, property, value) {
      const target = resolvePath(state._config, path);
      return shouldSet(target, property, value, mutability);
    },
    deleteProperty(_target, property) {
      const target = resolvePath(state._config, path);
      return shouldDelete(target, property, mutability);
    },
  });

  proxyCache.set(current, proxy);

  return proxy;
}

const EMPTY: ConfigRecord = Object.freeze({});

/**
 * Resolve a dotted path inside the config, returning an empty frozen object
 * when the path no longer points to an object (e.g. the parent key was
 * removed or changed to a primitive during a re-merge). This lets held nested
 * proxies return `undefined` gracefully instead of throwing a `TypeError`
 * (spec §7.2: consumers can hold a reference without it becoming stale).
 */
function resolvePath(config: ConfigRecord, path: string[]): ConfigRecord {
  let current: unknown = config;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return EMPTY;
    current = (current as ConfigRecord)[key];
  }
  return typeof current === 'object' && current !== null
    ? (current as ConfigRecord)
    : EMPTY;
}

function shouldSet(
  target: object,
  property: string | symbol,
  value: unknown,
  mutability: ConfigMutability,
): boolean {
  if (mutability === 'frozen') {
    return false;
  }
  return Reflect.set(target, property, value);
}

function shouldDelete(
  target: object,
  property: string | symbol,
  mutability: ConfigMutability,
): boolean {
  if (mutability === 'frozen') {
    return false;
  }
  return Reflect.deleteProperty(target, property);
}
