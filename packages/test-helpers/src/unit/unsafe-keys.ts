/**
 * Prototype pollution keys forbidden across all path and merge operations.
 *
 * Mirrors `@oclio/morsel`'s `unsafe-keys.ts` to keep `test-helpers`
 * independent of the core package.
 */
export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a key is a known prototype pollution vector.
 */
export function isUnsafeKey(key: string): boolean {
  return UNSAFE_KEYS.has(key);
}
