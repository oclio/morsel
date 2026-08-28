import { isPlainObject } from '@/merge/merge-helpers';
import { parsePath, type PathSegment, validatePath } from '@/paths/parse-path';
import type { ConfigRecord } from '@/store/types';

/**
 * Retrieve a value in a nested object or array using normalized path segments.
 *
 * @param target - Target object or array.
 * @param path - Dot path string or array of segments.
 * @returns Found value, or undefined if missing.
 */
export function getPathValue(
  target: unknown,
  path: string | readonly PathSegment[],
): unknown {
  const segments = typeof path === 'string' ? parsePath(path) : path;
  validatePath(segments);
  let current: unknown = target;

  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (Array.isArray(current)) {
        current = current[segment];
        continue;
      }
      return undefined;
    }

    if (isPlainObject(current)) {
      const record = current as ConfigRecord;
      if (Object.hasOwn(record, segment)) {
        current = record[segment];
        continue;
      }
    }

    return undefined;
  }

  return current;
}
