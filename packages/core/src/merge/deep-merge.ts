import { isPlainObject } from '@/merge/merge-helpers';
import type { ConfigRecord } from '@/store/types';

/**
 * Array merge strategy for `deepMerge`.
 *
 * - `'replace'` (default): the override array replaces the base array.
 * - `'concat'`: the override array is concatenated to the base array.
 */
export type ArrayMergeStrategy = 'replace' | 'concat';

function mergeArray(
  base: unknown[],
  override: unknown[],
  strategy: ArrayMergeStrategy,
): unknown[] {
  const clonedBase = base.map((item) => deepCloneValue(item));
  const clonedOverride = override.map((item) => deepCloneValue(item));
  return strategy === 'concat'
    ? [...clonedBase, ...clonedOverride]
    : clonedOverride;
}

/**
 * Recursively clone a value — objects and arrays are deep-cloned so that
 * freezing the result never mutates the caller's inputs.
 */
function deepCloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneValue(item));
  }
  if (isPlainObject(value)) {
    const clone: ConfigRecord = {};
    for (const [key, childValue] of Object.entries(value)) {
      clone[key] = deepCloneValue(childValue);
    }
    return clone;
  }
  return value;
}

/**
 * Deep merge two config records recursively.
 *
 * - Objects: deep merge recursively.
 * - Arrays: `replace` (default) or `concat` per strategy.
 * - Scalars: override wins.
 * - `undefined`: ignored (does not overwrite).
 * - `null`: overwrites (allows reset).
 *
 * @param base - The base config (lower priority).
 * @param override - The override config (higher priority).
 * @param strategy - Array merge strategy.
 * @returns A new merged config record — inputs are not mutated.
 */
export function deepMerge(
  base: ConfigRecord,
  override: ConfigRecord,
  strategy: ArrayMergeStrategy,
): ConfigRecord {
  const result: ConfigRecord = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = base[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue, strategy);
    } else if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      result[key] = mergeArray(baseValue, overrideValue, strategy);
    } else if (isPlainObject(overrideValue)) {
      result[key] = deepMerge({}, overrideValue, strategy);
    } else if (Array.isArray(overrideValue)) {
      result[key] = overrideValue.map((item) => deepCloneValue(item));
    } else {
      result[key] = overrideValue;
    }
  }

  return result;
}
