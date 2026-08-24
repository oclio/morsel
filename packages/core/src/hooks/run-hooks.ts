import { MorselError } from '@/errors/error';
import type {
  EventHook,
  Hook,
  HookContext,
  HookLifecycle,
  WriteEvent,
} from '@/hooks/types';
import { stripExtends } from '@/load/extends/extends-helpers';
import { buildHookLayer } from '@/load/layer-helpers';
import type { DebugCallback } from '@/load/resolve-env';
import { resolveEnv } from '@/load/resolve-env';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { isPlainObject } from '@/merge/merge-helpers';
import { noop } from '@/store/boot/assert-name';

type ConfigRecord = Record<string, unknown>;

/**
 * Apply reserved-key cleanup (`$env` resolution + `extends` stripping) to a
 * hook's raw output, mirroring the treatment applied to defaults/overrides and
 * file layers (spec §1.4: reserved keywords are never present in layer.config).
 *
 * Non-object results (contract violations) are passed through as-is — the
 * cleanup only applies to plain objects.
 */
function cleanupHookResult(
  result: ConfigRecord,
  context: HookContext,
  onDebug: DebugCallback,
): ConfigRecord {
  if (!isPlainObject(result)) {
    return result;
  }
  return stripExtends(
    resolveEnv(result, { envName: context.envName, onDebug }),
  );
}

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
  onDebug: DebugCallback = noop,
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

    layers.push(
      buildHookLayer(hook.name, cleanupHookResult(result, context, onDebug)),
    );
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
  onDebug: DebugCallback = noop,
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

    layers.push(
      buildHookLayer(hook.name, cleanupHookResult(resolved, context, onDebug)),
    );
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
