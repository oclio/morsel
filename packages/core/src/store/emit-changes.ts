import { diffKeys } from '@/merge/diff-keys';
import { isWildcardMatch } from '@/store/match-wildcard';
import type { Listener, MorselChangeEvent } from '@/store/types';

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
 * in each phase, sorted by pattern specificity (shallower first).
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
  const changes = diffKeys(oldConfig, newConfig);

  const removed = [...changes]
    .filter(([, change]) => change.category === 'removed')
    .sort(([a], [b]) => {
      const depthA = a.split('.').length;
      const depthB = b.split('.').length;
      if (depthA !== depthB) return depthB - depthA;
      return compareDesc(a, b);
    });

  const addedOrModified = [...changes]
    .filter(([, change]) => change.category !== 'removed')
    .sort(([a], [b]) => {
      const depthA = a.split('.').length;
      const depthB = b.split('.').length;
      if (depthA !== depthB) return depthA - depthB;
      return compareAsc(a, b);
    });

  for (const [key, change] of removed) {
    emitToListeners(key, change, listeners, wildcardListeners);
  }

  for (const [key, change] of addedOrModified) {
    emitToListeners(key, change, listeners, wildcardListeners);
  }
}

function emitToListeners(
  key: string,
  change: { category: string; next: unknown; prev: unknown },
  listeners: Map<string, Set<Listener>>,
  wildcardListeners: Map<string, Set<Listener>>,
): void {
  const event: MorselChangeEvent = {
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
