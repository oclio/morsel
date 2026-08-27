import type { ResolvedLayer } from '@/load/resolve-layer';
import type { ArrayMergeStrategy } from '@/merge/deep-merge';
import { deepMergeInPlace } from '@/merge/deep-merge';

type ConfigRecord = Record<string, unknown>;

/**
 * Mutability strategy applied to the merged config.
 */
export type ConfigMutability = 'frozen' | 'mutable';

/**
 * Apply mutability strategy to a config object.
 *
 * - `'frozen'`: `Object.freeze` recursive. Mutation → throw in strict mode.
 * - `'mutable'`: plain object, consumer is free to mutate.
 *
 * @param config - The config to freeze/wrap.
 * @param mutability - The mutability strategy.
 * @returns The config with mutability applied.
 */
export function applyMutability<T extends ConfigRecord>(
  config: T,
  mutability: ConfigMutability,
): T {
  switch (mutability) {
    case 'frozen': {
      return deepFreeze(config);
    }
    case 'mutable': {
      return config;
    }
  }
}

/**
 * Merge 4 resolved layers into a single config.
 *
 * Deep-merges layers in priority order: defaults → global → project → overrides.
 *
 * @param layers - The 4 resolved layers.
 * @param arrayMerge - Array merge strategy.
 * @returns The merged config.
 */
export function mergeLayers(
  layers: ResolvedLayer[],
  arrayMerge: ArrayMergeStrategy,
): ConfigRecord {
  let result: ConfigRecord = {};

  for (const layer of layers) {
    result = deepMergeInPlace(result, layer.config, arrayMerge);
  }

  return result;
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
