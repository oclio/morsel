import { getMorselRuntime } from '../shared/runtime';

/**
 * Clear the global watcher registry between e2e tests.
 * Without this, watchers from a previous test can survive
 * and fire on directories that no longer exist → flaky.
 */
export function clearWatcherRegistry(): void {
  if (typeof afterEach === 'function') {
    afterEach(() => {
      try {
        const runtime = getMorselRuntime();
        runtime.clearRegistry?.();
      } catch {
        // Runtime may not be registered in tests that don't need watcher registry
      }
    });
  }
}
