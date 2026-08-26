/**
 * Poll `onDebug` contexts until one matches a predicate or timeout elapses.
 * Used to wait for re-merge error handling to complete when the config does
 * not change (e.g. validation failure, parse error, hook throw).
 */
export async function waitForDebugContext(
  contexts: readonly Record<string, unknown>[],
  isMatch: (context: Record<string, unknown>) => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  const intervalMs = 50;

  while (Date.now() - start < timeoutMs) {
    if (contexts.some((context) => isMatch(context))) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `waitForDebugContext: condition not satisfied within ${timeoutMs}ms`,
  );
}
