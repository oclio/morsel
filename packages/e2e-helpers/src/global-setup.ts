import { clearRegistry } from '@oclio/morsel';

/**
 * Clear the global watcher registry between e2e tests.
 * Without this, watchers from a previous test can survive
 * and fire on directories that no longer exist → flaky.
 */
export function clearWatcherRegistry(): void {
  if (typeof afterEach === 'function') {
    afterEach(() => {
      clearRegistry();
    });
  }
}
