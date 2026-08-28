import type { FSWatcher } from 'node:fs';

import type { StoreState } from '@/store/store-state';
import { createFSWatcher } from '@/watch/watcher-recovery';

/**
 * Registry entry for a watched directory — holds the `fs.watch` handle,
 * a ref-count of stores sharing it, and an optional retry timer for recovery.
 *
 * @internal
 */
export interface WatcherEntry {
  watcher: FSWatcher | undefined;
  refCount: number;
  stores: Set<StoreState>;
  retryTimer: NodeJS.Timeout | undefined;
}

/**
 * Global watcher registry mapping directory paths to {@link WatcherEntry}.
 *
 * @internal
 */
export type WatcherRegistry = Map<string, WatcherEntry>;

const registry: WatcherRegistry = new Map();

/**
 * Create or reuse a watcher for a directory.
 *
 * If a watcher already exists for this directory, its ref-count is incremented
 * and the store is added to its store set. Otherwise, a new `fs.watch` is created.
 *
 * @param directoryPath - Absolute directory path to watch.
 * @param store - The store that needs this watcher.
 * @returns The watcher entry.
 */
export function createWatcher(
  directoryPath: string,
  store: StoreState,
): WatcherEntry {
  const existing = registry.get(directoryPath);

  if (existing !== undefined) {
    existing.refCount++;
    existing.stores.add(store);
    return existing;
  }

  const entry: WatcherEntry = {
    watcher: undefined,
    refCount: 1,
    stores: new Set([store]),
    retryTimer: undefined,
  };

  entry.watcher = createFSWatcher(registry, directoryPath, entry);
  registry.set(directoryPath, entry);
  return entry;
}

/**
 * Release a watcher reference for a store.
 *
 * Decrements ref-count and removes the store. If ref-count reaches 0,
 * the watcher is closed and removed from the registry.
 *
 * @param directoryPath - Absolute directory path.
 * @param store - The store releasing the watcher.
 */
export function releaseWatcher(directoryPath: string, store: StoreState): void {
  const entry = registry.get(directoryPath);
  if (entry === undefined) {
    return;
  }

  entry.stores.delete(store);
  entry.refCount--;

  if (entry.refCount <= 0) {
    if (entry.retryTimer !== undefined) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = undefined;
    }
    if (entry.watcher !== undefined) {
      entry.watcher.close();
    }
    registry.delete(directoryPath);
  }
}

/**
 * Get the global watcher registry (for testing).
 *
 * @internal
 */
export function getRegistry(): WatcherRegistry {
  return registry;
}

/**
 * Clear the global watcher registry (for testing).
 *
 * @internal
 */
export function clearRegistry(): void {
  for (const entry of registry.values()) {
    if (entry.retryTimer !== undefined) {
      clearTimeout(entry.retryTimer);
    }
    if (entry.watcher !== undefined) {
      entry.watcher.close();
    }
  }
  registry.clear();
}
