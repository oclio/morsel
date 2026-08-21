import path from 'node:path';

import type { WatcherEntry } from '@/watch/watcher-registry';

type WatcherRegistry = Map<string, WatcherEntry>;

function triggerUndefinedFilenameReMerge(
  entry: WatcherEntry,
  directoryPath: string,
): void {
  for (const store of entry.stores) {
    const basenames = store.watchedFiles.get(directoryPath);
    if (basenames === undefined || basenames.size === 0) {
      continue;
    }

    const debounceKey = `${directoryPath}:*:${store.projectPath}`;
    const existing = store.debounceTimers.get(debounceKey);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      store.debounceTimers.delete(debounceKey);
      void store.remerge(store);
    }, store.debounceMs);

    store.debounceTimers.set(debounceKey, timer);
  }
}

/**
 * Dispatch a filesystem watch event to all stores watching the affected file.
 * Debounces per file+store; undefined filename triggers a wildcard dispatch
 * to all stores with watched files in the directory.
 */
export function handleWatchEvent(
  registry: WatcherRegistry,
  directoryPath: string,
  filename: string | undefined,
): void {
  const entry = registry.get(directoryPath);
  if (entry === undefined) {
    return;
  }

  if (filename === undefined) {
    triggerUndefinedFilenameReMerge(entry, directoryPath);
    return;
  }

  const fullPath = path.resolve(directoryPath, filename);

  for (const store of entry.stores) {
    const basenames = store.watchedFiles.get(directoryPath);
    if (!basenames?.has(filename)) {
      continue;
    }

    const debounceKey = `${fullPath}:${store.projectPath}`;
    const existing = store.debounceTimers.get(debounceKey);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      store.debounceTimers.delete(debounceKey);
      void store.remerge(store);
    }, store.debounceMs);

    store.debounceTimers.set(debounceKey, timer);
  }
}
