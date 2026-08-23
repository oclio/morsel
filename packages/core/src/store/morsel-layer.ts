import type { ResolvedLayer } from '@/load/resolve-layer';
import type { MorselLayer } from '@/store/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Convert a {@link ResolvedLayer} into an immutable {@link MorselLayer}.
 * Deep-freezes the config and extendsPaths array.
 */
export function toMorselLayer(
  layer: ResolvedLayer,
  configName: string,
): MorselLayer {
  const base = {
    configName,
    source: layer.source,
    path: layer.path,
    config: deepFreeze({ ...layer.config }),
    exists: layer.exists,
    extendsPaths: Object.freeze([...layer.extendsPaths]),
  };

  return layer.hookName === undefined
    ? base
    : { ...base, hookName: layer.hookName };
}

function deepFreeze<T extends ConfigRecord>(
  object: T,
  visited = new WeakSet<object>(),
): T {
  if (visited.has(object)) {
    return object;
  }
  visited.add(object);
  for (const value of Object.values(object)) {
    if (typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as ConfigRecord, visited);
    }
  }
  return Object.freeze(object);
}
