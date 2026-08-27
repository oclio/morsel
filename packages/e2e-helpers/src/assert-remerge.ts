import { expect } from 'vitest';

import type { ReadableStore } from './wait-remerge';
import { waitForRemerge } from './wait-remerge';

type ConfigRecord = Record<string, unknown>;

/**
 * Wait for re-merge to produce the expected config, then assert it.
 *
 * Combines `waitForRemerge(store, predicate)` + `expect(store.config).toEqual(expected)`
 * into a single call. The predicate is derived from `expected` — every key in
 * `expected` must match before the assertion runs.
 *
 * Usage:
 *   `await assertRemerge(store!, { port: 8080 });`
 *   `await assertRemerge(store!, { port: 8080, host: 'localhost' });`
 */
export async function assertRemerge(
  store: ReadableStore,
  expected: ConfigRecord,
  timeoutMs?: number,
): Promise<void> {
  await waitForRemerge(
    store,
    (config) =>
      Object.keys(expected).every((key) => config[key] === expected[key]),
    timeoutMs,
  );
  expect(store.config).toEqual(expected);
}
