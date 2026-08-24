import { MorselError } from '@/errors/error';
import type {
  EventHook,
  Hook,
  HookContext,
  HookLifecycle,
  WriteEvent,
} from '@/hooks/types';
import { buildHookLayer } from '@/load/layer-helpers';
import type { ResolvedLayer } from '@/load/resolve-layer';

function isEventHook(hook: Hook): hook is EventHook {
  return hook.lifecycle === 'after:write';
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { then: unknown }).then === 'function'
  );
}

/**
 * Run all hooks matching a lifecycle point synchronously.
 *
 * Async hooks (returning a Promise) throw TypeError — use `runHooks` for async.
 * If a hook's `load` throws → MorselError (code EHOOK).
 */
export function runHooksSync(
  hooks: readonly Hook[],
  lifecycle: HookLifecycle,
  context: HookContext,
): ResolvedLayer[] {
  const layers: ResolvedLayer[] = [];

  for (const hook of hooks) {
    if (isEventHook(hook)) continue;
    if (hook.lifecycle !== lifecycle) continue;

    let result: Record<string, unknown> | Promise<Record<string, unknown>>;
    try {
      result = hook.load(context);
    } catch (error) {
      throw new MorselError(
        undefined,
        'EHOOK',
        new Error(
          `hook "${hook.name}" failed in ${lifecycle}: ${(error as Error).message}`,
        ),
      );
    }

    if (isPromise(result)) {
      throw new TypeError(
        `morsel: hook "${hook.name}" is async — use loadConfig or watchConfig`,
      );
    }

    layers.push(buildHookLayer(hook.name, result));
  }

  return layers;
}

/**
 * Run all hooks matching a lifecycle point asynchronously.
 *
 * Hooks are awaited in order. If a hook's `load` throws → MorselError (EHOOK).
 */
export async function runHooks(
  hooks: readonly Hook[],
  lifecycle: HookLifecycle,
  context: HookContext,
): Promise<ResolvedLayer[]> {
  const layers: ResolvedLayer[] = [];

  for (const hook of hooks) {
    if (isEventHook(hook)) continue;
    if (hook.lifecycle !== lifecycle) continue;

    let result: Record<string, unknown> | Promise<Record<string, unknown>>;
    try {
      result = hook.load(context);
    } catch (error) {
      throw new MorselError(
        undefined,
        'EHOOK',
        new Error(
          `hook "${hook.name}" failed in ${lifecycle}: ${(error as Error).message}`,
        ),
      );
    }

    let resolved: Record<string, unknown>;
    try {
      resolved = await result;
    } catch (error) {
      throw new MorselError(
        undefined,
        'EHOOK',
        new Error(
          `hook "${hook.name}" failed in ${lifecycle}: ${(error as Error).message}`,
        ),
      );
    }

    layers.push(buildHookLayer(hook.name, resolved));
  }

  return layers;
}

/**
 * Run all `after:write` event hooks after a successful write.
 *
 * Errors from `onWrite` are caught and logged via `onDebug` — the write is
 * already confirmed on disk, so the mutation is not rolled back.
 */
export async function runWriteHooks(
  hooks: readonly Hook[],
  event: WriteEvent,
  onDebug: (message: string, context?: Record<string, unknown>) => void,
): Promise<void> {
  for (const hook of hooks) {
    if (!isEventHook(hook)) continue;

    try {
      await hook.onWrite(event);
    } catch (error) {
      onDebug(
        `hook "${hook.name}" failed in after:write: ${(error as Error).message}`,
        { hookName: hook.name, event },
      );
    }
  }
}
