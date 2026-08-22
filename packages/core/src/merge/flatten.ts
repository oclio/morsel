import { isPlainObject } from '@/merge/merge-helpers';
import type { ConfigRecord } from '@/store/types';

/**
 * Flatten a config object into a Map of dotted keys to scalar/array values.
 * Stops at arrays — they are treated as leaf values.
 *
 * Example: `{ foo: { bar: 123 } }` → `Map { 'foo.bar' => 123 }`
 *
 * @param object - The config object to flatten.
 * @returns A Map of dotted keys to values.
 */
export function flatten(object: ConfigRecord): Map<string, unknown> {
  const result = new Map<string, unknown>();

  function walk(value: unknown, prefix: string): void {
    if (isPlainObject(value)) {
      for (const [key, childValue] of Object.entries(value)) {
        const childKey = prefix === '' ? key : `${prefix}.${key}`;
        walk(childValue, childKey);
      }
    } else {
      result.set(prefix, value);
    }
  }

  walk(object, '');
  return result;
}
