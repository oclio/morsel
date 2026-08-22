import { existsSync, type FSWatcher, watch } from 'node:fs';

import { noop } from '@/store/assert-name';
import type { StoreState } from '@/store/store-state';
import { handleWatchEvent } from '@/watch/handle-event';

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
 * Log a message to stderr and route it to each non-stopped store's onDebug.
 *
 * Used by the watcher retry logic — since a watcher is shared between stores,
 * the message is forwarded to every store's onDebug callback (if real), or to
 * stderr once if any store has the default noop onDebug (spec §5.2: onDebug
 * routes messages instead of stderr, not in addition to).
 */
function logToStores(
  entry: WatcherEntry,
  message: string,
  context?: Record<string, unknown>,
): void {
  let isNeedsStderr = false;
  for (const store of entry.stores) {
    if (store.stopped) continue;
    if (store.options.onDebug === noop) {
      isNeedsStderr = true;
    } else {
      store.options.onDebug(message, context);
    }
  }
  if (isNeedsStderr) {
    console.error(message);
  }
}

/**
 * Check if any non-stopped store in the entry has verbose mode enabled.
 */
function hasVerbose(entry: WatcherEntry): boolean {
  for (const store of entry.stores) {
    if (!store.stopped && store.options.verbose) return true;
  }
  return false;
}

function startRecovery(entry: WatcherEntry, directoryPath: string): void {
  if (entry.retryTimer !== undefined) {
    return;
  }

  if (entry.watcher !== undefined) {
    void entry.watcher.close();
  }
  logToStores(
    entry,
    `morsel: fs.watch crashed for ${directoryPath} — retrying in 1s`,
  );

  const poll = (): void => {
    if (entry.stores.size === 0) {
      entry.retryTimer = undefined;
      return;
    }

    if (!existsSync(directoryPath)) {
      logToStores(
        entry,
        `morsel: directory ${directoryPath} still missing — retrying in 1s`,
      );
      entry.retryTimer = setTimeout(poll, 1000);
      return;
    }

    if (hasVerbose(entry)) {
      logToStores(entry, `morsel: re-attaching fs.watch to ${directoryPath}`);
    }

    const newWatcher = createFSWatcher(directoryPath, entry);
    entry.watcher = newWatcher;
    entry.retryTimer = undefined;

    for (const s of entry.stores) {
      if (s.stopped) {
        continue;
      }
      s.remerge(s);
    }
  };

  entry.retryTimer = setTimeout(poll, 1000);
}

function createFSWatcher(
  directoryPath: string,
  entry: WatcherEntry,
): FSWatcher | undefined {
  if (!existsSync(directoryPath)) {
    startRecovery(entry, directoryPath);
    return undefined;
  }

  const watcher = watch(directoryPath, (_eventType, filename) => {
    if (!existsSync(directoryPath)) {
      startRecovery(entry, directoryPath);
      return;
    }
    handleWatchEvent(registry, directoryPath, filename ?? undefined);
  });

  watcher.on('error', () => {
    startRecovery(entry, directoryPath);
  });

  return watcher;
}

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

  entry.watcher = createFSWatcher(directoryPath, entry);
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
