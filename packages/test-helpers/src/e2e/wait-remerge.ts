import { pollUntil } from './poll-until';

/**
Minimal store interface with a readable `config` property.
*/
export interface ReadableStore {
  readonly config: unknown;
}

/**
 * Poll a store until its config matches a predicate or timeout elapses.
 * Used to wait for re-merge to complete after a file change.
 *
 * @param store - The store whose `config` should be polled.
 * @param isMatch - Predicate that receives the current config and returns
 *   `true` when the expected state is reached.
 * @param timeoutMs - Maximum time to wait in milliseconds. Defaults to 5000.
 * @throws If the predicate is not satisfied within `timeoutMs`.
 */
export async function waitForRemerge(
  store: ReadableStore,
  isMatch: (config: Record<string, unknown>) => boolean,
  timeoutMs = 5000,
): Promise<void> {
  await pollUntil(
    () => isMatch(store.config as Record<string, unknown>),
    timeoutMs,
    `waitForRemerge: condition not satisfied within ${timeoutMs}ms`,
  );
}
