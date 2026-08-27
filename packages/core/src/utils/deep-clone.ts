import { isPlainObject } from '@/merge/merge-helpers';
import type { ConfigRecord } from '@/store/types';
import { isUnsafeKey } from '@/utils/unsafe-keys';

/**
 * Recursively clone a value — plain objects and arrays are deep-cloned,
 * all other values (primitives, null, undefined, class instances) are
 * returned as-is.
 *
 * Unsafe keys (`__proto__`, `constructor`, `prototype`) are filtered out
 * during object cloning to prevent prototype pollution.
 *
 * @param value - The value to clone.
 * @returns A deep clone of the value, with unsafe keys removed.
 */
export function deepClone<T>(value: T): T {
  if (isPlainObject(value)) {
    const result: ConfigRecord = {};
    for (const [key, childValue] of Object.entries(value)) {
      if (isUnsafeKey(key)) continue;
      result[key] = deepClone(childValue);
    }
    return result as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  return value;
}
