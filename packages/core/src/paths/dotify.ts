import { isPlainObject } from '@/merge/merge-helpers';

function dotifyPlainObject(
  record: Record<string, unknown>,
  prefix: string,
  result: Record<string, unknown>,
): void {
  const keys = Object.keys(record);
  if (keys.length === 0 && prefix.length > 0) {
    result[prefix] = {};
    return;
  }
  for (const key of keys) {
    const nextPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
    dotifyObject(record[key], nextPrefix, result);
  }
}

function dotifyArray(
  array: unknown[],
  prefix: string,
  result: Record<string, unknown>,
): void {
  if (array.length === 0 && prefix.length > 0) {
    result[prefix] = [];
    return;
  }
  for (const [index, element] of array.entries()) {
    const nextPrefix = `${prefix}[${index}]`;
    dotifyObject(element, nextPrefix, result);
  }
}

/**
 * Flatten a nested object structure into a 1D record with dotted paths.
 *
 * @param object - The nested object or array to flatten.
 * @param prefix - Internal accumulator for parent path prefixes.
 * @param result - Internal accumulator for flat key-value pairs.
 * @returns A 1D Record of dotted paths to leaf values.
 */
export function dotifyObject(
  object: unknown,
  prefix = '',
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  if (isPlainObject(object)) {
    dotifyPlainObject(object as Record<string, unknown>, prefix, result);
  } else if (Array.isArray(object)) {
    dotifyArray(object, prefix, result);
  } else if (prefix.length > 0) {
    result[prefix] = object;
  }

  return result;
}
