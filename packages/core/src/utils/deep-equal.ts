/**
 * Deep structural equality for JSON-like values.
 *
 * Primitives are compared via `Object.is` (handles `NaN`, `+0`/`-0`).
 * Plain objects and arrays are compared recursively by keys and values.
 * Non-plain objects (`Date`, `Map`, `Set`, `RegExp`, `Error`, custom classes)
 * return `false` — a mutation setting a non-plain object is always detected
 * as dirty. No false positives.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns `true` if structurally equal, `false` otherwise.
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!Array.isArray(a) && Object.getPrototypeOf(a) !== Object.prototype)
    return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    isDeepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}
