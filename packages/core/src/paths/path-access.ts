import { isPlainObject } from '@/merge/merge-helpers';
import { parsePath, type PathSegment } from '@/paths/parse-path';
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

function ensureChild(
  parent: ConfigRecord | unknown[],
  segment: PathSegment,
  nextSegment: PathSegment | undefined,
): ConfigRecord | unknown[] {
  const container = parent as Record<string | number, unknown>;
  const existing = container[segment];

  if (isPlainObject(existing) || Array.isArray(existing)) {
    return existing as ConfigRecord | unknown[];
  }

  const created = typeof nextSegment === 'number' ? [] : {};
  container[segment] = created;
  return created;
}

/**
 * Set a value in a nested object/array structure by path segments.
 * Creates intermediate objects or arrays as needed.
 *
 * @param target - Target object or array.
 * @param path - Dot path string or array of segments.
 * @param value - Value to set.
 */
export function setPathValue(
  target: ConfigRecord | unknown[],
  path: string | readonly PathSegment[],
  value: unknown,
): void {
  const segments = typeof path === 'string' ? parsePath(path) : path;
  if (segments.length === 0) {
    return;
  }

  let current = target;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index] as PathSegment;
    const nextSegment = segments[index + 1];
    current = ensureChild(current, segment, nextSegment);
  }

  const lastSegment = segments.at(-1) as PathSegment;
  const container = current as Record<string | number, unknown>;
  container[lastSegment] = value;
}

function isLastSegmentRemoved(
  container: unknown,
  lastSegment: PathSegment,
): boolean {
  if (typeof lastSegment === 'number' && Array.isArray(container)) {
    if (lastSegment >= 0 && lastSegment < container.length) {
      container.splice(lastSegment, 1);
      return true;
    }
    return false;
  }

  if (typeof lastSegment === 'string' && isPlainObject(container)) {
    const record = container as ConfigRecord;
    if (Object.hasOwn(record, lastSegment)) {
      record[lastSegment] = undefined;
      Reflect.deleteProperty(record, lastSegment);
      return true;
    }
  }

  return false;
}

/**
 * Remove a value from a nested object or array structure by path segments.
 *
 * @param target - Target object or array.
 * @param path - Dot path string or array of segments.
 * @returns Whether the key or element was found and removed.
 */
export function hasRemovedPathValue(
  target: ConfigRecord | unknown[],
  path: string | readonly PathSegment[],
): boolean {
  const segments = typeof path === 'string' ? parsePath(path) : path;

  const parentSegments = segments.slice(0, -1);
  const parent = getPathValue(target, parentSegments);
  const lastSegment = segments.at(-1) as PathSegment;

  return isLastSegmentRemoved(parent, lastSegment);
}
