export interface StoreEvent {
  readonly keyPath: string;
  readonly type: string;
  readonly next: unknown;
  readonly prev: unknown;
}

export type EventListener = (event: StoreEvent) => void;

export interface EventCollector {
  readonly events: StoreEvent[];
  readonly listener: EventListener;
}

/**
 * Collect store `on()` events into an `events` array for assertion.
 * Usage:
 *   const \{ events, listener \} = createEventCollector();
 *   store.on('port', listener);
 *   // ... trigger mutation ...
 *   expect(events).toHaveLength(1);
 */
export function createEventCollector(): EventCollector {
  const events: StoreEvent[] = [];
  const listener: EventListener = (event) => {
    events.push(event);
  };
  return { events, listener };
}
