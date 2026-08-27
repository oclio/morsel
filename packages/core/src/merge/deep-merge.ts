import { isPlainObject } from '@/merge/merge-helpers';
import type { ConfigRecord } from '@/store/types';
import { deepClone } from '@/utils/deep-clone';
import { isUnsafeKey } from '@/utils/unsafe-keys';

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
  const clonedBase = base.map((item) => deepClone(item));
  const clonedOverride = override.map((item) => deepClone(item));
  return strategy === 'concat'
    ? [...clonedBase, ...clonedOverride]
    : clonedOverride;
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
function cloneBaseEntries(base: ConfigRecord): ConfigRecord {
  const result: ConfigRecord = {};
  for (const [key, baseValue] of Object.entries(base)) {
    if (isUnsafeKey(key)) continue;
    result[key] = deepClone(baseValue);
  }
  return result;
}

function mergeOverrideEntry(
  baseValue: unknown,
  overrideValue: unknown,
  strategy: ArrayMergeStrategy,
): unknown {
  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    return deepMerge(baseValue, overrideValue, strategy);
  }
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return mergeArray(baseValue, overrideValue, strategy);
  }
  if (isPlainObject(overrideValue)) {
    return deepMerge({}, overrideValue, strategy);
  }
  if (Array.isArray(overrideValue)) {
    return overrideValue.map((item) => deepClone(item));
  }
  return overrideValue;
}

export function deepMerge(
  base: ConfigRecord,
  override: ConfigRecord,
  strategy: ArrayMergeStrategy,
): ConfigRecord {
  const result = cloneBaseEntries(base);

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) {
      continue;
    }
    if (isUnsafeKey(key)) {
      continue;
    }
    result[key] = mergeOverrideEntry(base[key], overrideValue, strategy);
  }

  return result;
}
