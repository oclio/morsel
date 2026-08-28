import { pollUntil } from './poll-until';

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
  await pollUntil(
    () => contexts.some((context) => isMatch(context)),
    timeoutMs,
    `waitForDebugContext: condition not satisfied within ${timeoutMs}ms`,
  );
}
