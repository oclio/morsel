/**
 * Prototype pollution keys forbidden across all path and merge operations.
 *
 * Shared between `deepMerge` (clone/merge filtering) and `parsePath`
 * (segment validation) to guarantee a single source of truth.
 */
export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a key is a known prototype pollution vector.
 */
export function isUnsafeKey(key: string): boolean {
  return UNSAFE_KEYS.has(key);
}
