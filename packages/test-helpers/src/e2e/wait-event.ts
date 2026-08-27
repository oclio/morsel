/**
Minimal store interface that can emit events via `on()`.
*/
export interface EventObservable {
  on(
    key: string,
    listener: (event: {
      readonly keyPath: string;
      readonly type: string;
      readonly next: unknown;
      readonly prev: unknown;
    }) => void,
    options?: Record<string, never>,
  ): () => void;
}

/**
 * Wait for an event to fire on a store within a timeout.
 * Returns the payload received by the listener.
 *
 * @param store - The store to listen on.
 * @param key - The dotted key path to listen for (e.g. `'port'`, `'server.host'`).
 * @param timeoutMs - Maximum time to wait in milliseconds. Defaults to 5000.
 * @returns The event payload `{ next, prev }` once the event fires.
 * @throws If the event does not fire within `timeoutMs`.
 */
export async function waitForEvent(
  store: EventObservable,
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

    const off = store.on(key, (event) => {
      clearTimeout(timer);
      off();
      resolve({ next: event.next, prev: event.prev });
    });
  });
}
