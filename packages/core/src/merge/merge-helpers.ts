type ConfigRecord = Record<string, unknown>;

/**
 * Type guard: returns `true` when `value` is a plain object (created via
 * `{}` or `Object.create(null)`), `false` for arrays, class instances,
 * and primitives.
 */
export function isPlainObject(value: unknown): value is ConfigRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
