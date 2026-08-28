type ConfigRecord = Record<string, unknown>;

/**
 * Recursively freeze an object and all nested plain objects/arrays.
 *
 * - Cycle-safe via a `WeakSet` of visited objects.
 * - Skips already-frozen values and non-object values (primitives, functions).
 * - Returns the same reference, now frozen.
 */
export function deepFreeze<T extends ConfigRecord>(
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
