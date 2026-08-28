/**
 * Poll a predicate until it returns true or timeout elapses.
 *
 * @param isDone - Returns `true` when the expected state is reached.
 * @param timeoutMs - Maximum time to wait in milliseconds. Defaults to 5000.
 * @param errorMessage - Error message thrown if the predicate is not satisfied.
 * @param intervalMs - Polling interval in milliseconds. Defaults to 50.
 * @throws If the predicate is not satisfied within `timeoutMs`.
 */
export async function pollUntil(
  isDone: () => boolean,
  timeoutMs = 5000,
  errorMessage: string,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (isDone()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(errorMessage);
}
