import { diffKeys } from '@/merge/diff-keys';
import { isWildcardMatch } from '@/store/reactive/match-wildcard';
import type { ChangeEvent, Listener } from '@/store/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Compute the diff between old and new config, then emit events
 * to all registered listeners for changed keys.
 *
 * Events are emitted in two phases to guarantee `store.config` consistency
 * when listeners read parent keys:
 *
 * 1. Removed keys — bottom-up (deepest first), so child listeners fire
 *    before their parent type-changes.
 * 2. Added and modified keys — top-down (shallowest first), so parent
 *    listeners see the new type before child listeners fire.
 *
 * Wildcard listeners (`foo.*`, `**`) are emitted after exact listeners
 * in each phase, in insertion order.
 *
 * @param oldConfig - The previous config snapshot.
 * @param newConfig - The new config snapshot.
 * @param listeners - Map of dotted keys to exact-match listener sets.
 * @param wildcardListeners - Map of wildcard patterns to listener sets.
 */
export function emitChanges(
  oldConfig: ConfigRecord,
  newConfig: ConfigRecord,
  listeners: Map<string, Set<Listener>>,
  wildcardListeners = new Map<string, Set<Listener>>(),
): void {
  const changes: {
    key: string;
    change: { category: string; next: unknown; prev: unknown };
    depth: number;
  }[] = [];
  for (const [key, change] of diffKeys(oldConfig, newConfig)) {
    changes.push({ key, change, depth: key.split('.').length });
  }

  const removed = changes
    .filter(({ change }) => change.category === 'removed')
    .sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      return compareDesc(a.key, b.key);
    });

  const addedOrModified = changes
    .filter(({ change }) => change.category !== 'removed')
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return compareAsc(a.key, b.key);
    });

  for (const { key, change } of removed) {
    emitToListeners(key, change, listeners, wildcardListeners);
  }

  for (const { key, change } of addedOrModified) {
    emitToListeners(key, change, listeners, wildcardListeners);
  }
}

function emitToListeners(
  key: string,
  change: { category: string; next: unknown; prev: unknown },
  listeners: Map<string, Set<Listener>>,
  wildcardListeners: Map<string, Set<Listener>>,
): void {
  const event: ChangeEvent = {
    keyPath: key,
    type: change.category as 'added' | 'modified' | 'removed',
    next: change.next,
    prev: change.prev,
  };

  const set = listeners.get(key);
  if (set !== undefined) {
    for (const listener of set) {
      listener(event);
    }
  }

  for (const [pattern, wildcardSet] of wildcardListeners) {
    if (isWildcardMatch(pattern, key)) {
      for (const listener of wildcardSet) {
        listener(event);
      }
    }
  }
}

/**
 * Ascending string comparator for dotted keys.
 */
export function compareAsc(a: string, b: string): number {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

function compareDesc(a: string, b: string): number {
  return -compareAsc(a, b);
}
