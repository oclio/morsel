import { existsSync, type FSWatcher, watch } from 'node:fs';

import { noop } from '@/store/boot/assert-name';
import { handleWatchEvent } from '@/watch/handle-event';
import type { WatcherEntry, WatcherRegistry } from '@/watch/watcher-registry';

/**
 * Route a debug message to each non-stopped store via its configured channel.
 *
 * Since a watcher is shared between stores, the message is delivered to every
 * active store: stores with a real `onDebug` callback receive it there, while
 * stores using the default `noop` receive it via a single `console.error`
 * emission (stderr is a shared channel, so it is written once for all noop
 * stores rather than once per store). This respects spec §5.2 per-store: each
 * store gets the message through exactly one channel — its own `onDebug` if
 * configured, or stderr otherwise.
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

function startRecovery(
  registry: WatcherRegistry,
  entry: WatcherEntry,
  directoryPath: string,
): void {
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

    const newWatcher = createFSWatcher(registry, directoryPath, entry);
    entry.watcher = newWatcher;
    entry.retryTimer = undefined;

    for (const s of entry.stores) {
      if (s.stopped) {
        continue;
      }
      void s.remerge(s);
    }
  };

  entry.retryTimer = setTimeout(poll, 1000);
}

/**
 * Create an `fs.watch` handle for a directory, or start recovery if the
 * directory does not exist. The watcher dispatches events to
 * {@link handleWatchEvent} and starts recovery on error or missing directory.
 *
 * @param registry - The global watcher registry (for event dispatch).
 * @param directoryPath - Absolute directory path to watch.
 * @param entry - The registry entry owning this watcher.
 * @returns The `fs.watch` handle, or `undefined` if recovery was started.
 */
export function createFSWatcher(
  registry: WatcherRegistry,
  directoryPath: string,
  entry: WatcherEntry,
): FSWatcher | undefined {
  if (!existsSync(directoryPath)) {
    startRecovery(registry, entry, directoryPath);
    return undefined;
  }

  const watcher = watch(directoryPath, (_eventType, filename) => {
    if (!existsSync(directoryPath)) {
      startRecovery(registry, entry, directoryPath);
      return;
    }
    handleWatchEvent(registry, directoryPath, filename ?? undefined);
  });

  watcher.on('error', () => {
    startRecovery(registry, entry, directoryPath);
  });

  return watcher;
}
