export type DebugCallback = (
  message: string,
  context?: Record<string, unknown>,
) => void;

export interface DebugCollector {
  readonly messages: string[];
  readonly contexts: Record<string, unknown>[];
  readonly callback: DebugCallback;
}

/**
 * Collect `onDebug` calls into `messages` and `contexts` arrays for
 * assertion in re-merge error tests. Tests that only need contexts
 * can ignore `messages`.
 */
export function createDebugCollector(): DebugCollector {
  const messages: string[] = [];
  const contexts: Record<string, unknown>[] = [];
  const callback: DebugCallback = (message, context) => {
    messages.push(message);
    if (context) {
      contexts.push(context);
    }
  };
  return { messages, contexts, callback };
}
