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
  const clonedOverride = override.map((item) => deepClone(item));
  return strategy === 'concat'
    ? [...base.map((item) => deepClone(item)), ...clonedOverride]
    : clonedOverride;
}

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

/**
 * In-place variant of {@link deepMerge} — mutates `base` directly instead of
 * cloning it. Use only when the caller owns `base` and no external references
 * to it exist. Used by `mergeLayers` to avoid re-cloning the accumulator
 * between successive layer merges.
 *
 * @param base - The base config (mutated in place, lower priority).
 * @param override - The override config (higher priority, not mutated).
 * @param strategy - Array merge strategy.
 * @returns The same `base` object with override applied.
 */
export function deepMergeInPlace(
  base: ConfigRecord,
  override: ConfigRecord,
  strategy: ArrayMergeStrategy,
): ConfigRecord {
  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) {
      continue;
    }
    if (isUnsafeKey(key)) {
      continue;
    }
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      base[key] = deepMergeInPlace(baseValue, overrideValue, strategy);
    } else if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      base[key] = mergeArray(baseValue, overrideValue, strategy);
    } else if (isPlainObject(overrideValue)) {
      base[key] = deepMerge({}, overrideValue, strategy);
    } else if (Array.isArray(overrideValue)) {
      base[key] = overrideValue.map((item) => deepClone(item));
    } else {
      base[key] = overrideValue;
    }
  }

  return base;
}
