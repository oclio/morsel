import { deepMerge } from '@/merge/deep-merge';
import { isPlainObject } from '@/merge/merge-helpers';
import { noop } from '@/store/boot/assert-name';

type ConfigRecord = Record<string, unknown>;

/**
 * Debug callback invoked when a non-fatal issue is detected (e.g. invalid `$env`).
 * Receives a human-readable message and optional context.
 */
export type DebugCallback = (
  message: string,
  context?: Record<string, unknown>,
) => void;

interface ResolveEnvironmentOptions {
  readonly envName: string | undefined;
  readonly onDebug: DebugCallback | undefined;
}

/**
 * Apply `$env` overrides to a config object.
 *
 * If `envName` matches a key in `$env`, the corresponding object is deep-merged
 * on top of the config. `$env` is removed from the result.
 *
 * If `$env` is present but `envName` is undefined, a warning is emitted via
 * `onDebug`/stderr and `$env` is ignored.
 *
 * @param config - The raw config object (will not be mutated).
 * @param options - `{ envName, onDebug }`
 * @returns A new config with `$env` applied and removed.
 */
export function resolveEnv(
  config: ConfigRecord,
  options: ResolveEnvironmentOptions,
): ConfigRecord {
  const { envName, onDebug } = options;
  const { $env: envBlock, ...result } = config;

  if (envBlock === undefined) {
    return result;
  }

  if (envName === undefined) {
    const message = `morsel: $env present but envName is undefined — ignoring $env`;
    logDebug(onDebug, message);
    return result;
  }

  if (!isPlainObject(envBlock)) {
    const message = `morsel: $env block is not a plain object — ignoring $env`;
    logDebug(onDebug, message);
    return result;
  }

  const envOverride = envBlock[envName];
  if (isPlainObject(envOverride)) {
    const merged = deepMerge(result, envOverride, 'replace');
    delete merged['$env'];
    return merged;
  }

  return result;
}

function logDebug(onDebug: DebugCallback | undefined, message: string): void {
  if (onDebug === undefined || onDebug === noop) {
    console.error(message);
  } else {
    onDebug(message);
  }
}
