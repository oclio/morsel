import { flatten } from '@/merge/flatten';
import { isPlainObject } from '@/merge/merge-helpers';

type ConfigRecord = Record<string, unknown>;

/**
 * Category of a detected key change between two configs.
 */
export type ChangeCategory = 'added' | 'modified' | 'removed';

/**
 * A single key change produced by {@link diffKeys}.
 */
export interface KeyChange {
  readonly next: unknown;
  readonly prev: unknown;
  readonly category: ChangeCategory;
}

/**
 * Retrieve a nested value from a config object by dotted key.
 *
 * @param object - The config object to traverse.
 * @param dottedKey - Dot-separated path (e.g. `a.b.c`).
 * @returns The value at that path, or `undefined` if any segment is missing.
 */
function getPath(object: ConfigRecord, dottedKey: string): unknown {
  const parts = dottedKey.split('.');
  let current: unknown = object;
  for (const part of parts) {
    if (isPlainObject(current)) {
      const record = current as ConfigRecord;
      if (Object.hasOwn(record, part)) {
        current = record[part];
        continue;
      }
    }
    return undefined;
  }
  return current;
}

/**
 * Detect keys present in `oldFlat` that changed or disappeared in `newFlat`.
 *
 * @param oldFlat - Flattened previous config.
 * @param newFlat - Flattened new config.
 * @param oldObject - Original previous config (for getPath on type changes).
 * @param newObject - Original new config (for getPath on type changes).
 * @param visited - Set populated with every key seen in oldFlat.
 * @returns A Map of changes for keys present in oldFlat.
 */
function detectRemovedAndModified(
  oldFlat: Map<string, unknown>,
  newFlat: Map<string, unknown>,
  oldObject: ConfigRecord,
  newObject: ConfigRecord,
  visited: Set<string>,
): Map<string, KeyChange> {
  const changes = new Map<string, KeyChange>();

  for (const [key, previous] of oldFlat) {
    visited.add(key);

    if (!newFlat.has(key)) {
      const nextValue = getPath(newObject, key);
      if (nextValue === undefined) {
        changes.set(key, {
          next: undefined,
          prev: previous,
          category: 'removed',
        });
      } else {
        changes.set(key, {
          next: nextValue,
          prev: previous,
          category: 'modified',
        });
      }
      continue;
    }

    const next = newFlat.get(key);

    if (!Object.is(next, previous)) {
      changes.set(key, { next, prev: previous, category: 'modified' });
    }
  }

  return changes;
}

/**
 * Detect keys present in `newFlat` that are new or replaced an object in `oldFlat`.
 *
 * @param newFlat - Flattened new config.
 * @param oldFlat - Flattened previous config.
 * @param oldObject - Original previous config (for getPath on type changes).
 * @param visited - Keys already seen in oldFlat (skip them).
 * @returns A Map of changes for keys only present in newFlat.
 */
function detectAdded(
  newFlat: Map<string, unknown>,
  oldFlat: Map<string, unknown>,
  oldObject: ConfigRecord,
  visited: Set<string>,
): Map<string, KeyChange> {
  const changes = new Map<string, KeyChange>();

  for (const [key, next] of newFlat) {
    if (visited.has(key)) {
      continue;
    }

    const prevValue = getPath(oldObject, key);
    if (prevValue === undefined) {
      changes.set(key, { next, prev: undefined, category: 'added' });
    } else {
      changes.set(key, {
        next,
        prev: prevValue,
        category: 'modified',
      });
    }
  }

  return changes;
}

/**
 * Synthesize parent events for wholly-added objects.
 *
 * Walks `newObject` recursively. When a plain object exists at a key that
 * was absent from `oldObject`, emits that key as `added` with the full
 * object as `next`. Does not recurse into wholly-added objects — their
 * scalar leaves are already in the changes map from `detectAdded`.
 *
 * For objects that existed in both configs (or type-changed from scalar),
 * recurses to find nested wholly-added objects.
 */
function synthesizeAddedParents(
  changes: Map<string, KeyChange>,
  oldObject: ConfigRecord,
  newObject: ConfigRecord,
): void {
  function walk(object: ConfigRecord, prefix: string): void {
    for (const [key, value] of Object.entries(object)) {
      const dottedKey = prefix === '' ? key : `${prefix}.${key}`;

      if (isPlainObject(value)) {
        if (getPath(oldObject, dottedKey) === undefined) {
          changes.set(dottedKey, {
            next: value,
            prev: undefined,
            category: 'added',
          });
        } else {
          walk(value, dottedKey);
        }
      }
    }
  }
  walk(newObject, '');
}

/**
 * Synthesize parent events for wholly-removed objects.
 *
 * Walks `oldObject` recursively. When a plain object existed at a key that
 * is absent from `newObject`, emits that key as `removed` with the full
 * object as `prev`. Does not recurse into wholly-removed objects — their
 * scalar leaves are already in the changes map from `detectRemovedAndModified`.
 *
 * For objects that still exist in both configs (or type-changed to scalar),
 * recurses to find nested wholly-removed objects.
 */
function synthesizeRemovedParents(
  changes: Map<string, KeyChange>,
  oldObject: ConfigRecord,
  newObject: ConfigRecord,
): void {
  function walk(object: ConfigRecord, prefix: string): void {
    for (const [key, value] of Object.entries(object)) {
      const dottedKey = prefix === '' ? key : `${prefix}.${key}`;

      if (isPlainObject(value)) {
        if (getPath(newObject, dottedKey) === undefined) {
          changes.set(dottedKey, {
            next: undefined,
            prev: value,
            category: 'removed',
          });
        } else {
          walk(value, dottedKey);
        }
      }
    }
  }
  walk(oldObject, '');
}

/**
 * Compute the diff between two config objects as a Map of dotted keys to changes.
 *
 * - Scalars: emit the key if the value changed.
 * - Objects: descend recursively into children.
 * - Arrays: emit the parent key if the array changed (no per-index diff).
 * - Type changes (scalar ↔ object): emit the parent as `modified` with the
 *   full old/new object as `prev`/`next`, plus all child scalars as
 *   `added`/`removed`.
 * - Wholly-added/removed objects: emit the parent key as `added`/`removed`
 *   with the full object, plus all child scalars.
 *
 * @param oldObject - The previous config.
 * @param newObject - The new config.
 * @returns A Map of dotted keys to `{ next, prev, category }` changes.
 */
export function diffKeys(
  oldObject: ConfigRecord,
  newObject: ConfigRecord,
): Map<string, KeyChange> {
  const oldFlat = flatten(oldObject);
  const newFlat = flatten(newObject);
  const visited = new Set<string>();

  const removedAndModified = detectRemovedAndModified(
    oldFlat,
    newFlat,
    oldObject,
    newObject,
    visited,
  );
  const added = detectAdded(newFlat, oldFlat, oldObject, visited);

  const changes = new Map([...removedAndModified, ...added]);

  synthesizeAddedParents(changes, oldObject, newObject);
  synthesizeRemovedParents(changes, oldObject, newObject);

  return changes;
}
