import type { MorselStore } from '@oclio/morsel';

/**
 * Wait for an event to fire on a store within a timeout.
 * Returns the payload received by the listener.
 */
export async function waitForEvent(
  store: MorselStore,
  key: string,
  timeoutMs = 5000,
): Promise<{ next: unknown; prev: unknown }> {
  return new Promise<{ next: unknown; prev: unknown }>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(
        new Error(`waitForEvent: "${key}" did not fire within ${timeoutMs}ms`),
      );
    }, timeoutMs);

    const off = store.on(key, (next: unknown, prev: unknown) => {
      clearTimeout(timer);
      off();
      resolve({ next, prev });
    });
  });
}
