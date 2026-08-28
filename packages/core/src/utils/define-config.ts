import { deepMerge } from '@/merge/deep-merge';
import type { ConfigRecord, MorselOptions } from '@/store/types';

/**
 * Type helper — infers `T` from `defaults`.
 *
 * The consumer doesn't need to declare the interface explicitly.
 * Pass the result to `loadConfig`, `loadConfigSync`, or `createReactiveStore`.
 *
 * @param config - The config options with typed defaults/overrides.
 * @returns The same config options (identity — type inference only).
 */
export function defineConfig<T extends Record<string, unknown>>(
  config: MorselOptions<T>,
): MorselOptions<T> {
  return config;
}

/**
 * Compose two config option sets via deep merge.
 *
 * `defaults` and `overrides` are deep-merged. Other options (name, cwd, etc.)
 * are taken from `base`, overridden by `overrides` if present. `T` is preserved.
 *
 * @param base - The base config options.
 * @param overrides - The partial overrides to merge in.
 * @returns The composed config options.
 */
export function mergeConfig<T extends Record<string, unknown> = ConfigRecord>(
  base: MorselOptions<T>,
  overrides: Partial<MorselOptions<T>>,
): MorselOptions<T> {
  const strategy = overrides.arrayMerge ?? base.arrayMerge ?? 'replace';
  const result = { ...base, ...overrides } as MorselOptions<T>;

  if (overrides.defaults !== undefined && base.defaults !== undefined) {
    (result as { defaults: T }).defaults = deepMerge(
      base.defaults as ConfigRecord,
      overrides.defaults as ConfigRecord,
      strategy,
    ) as T;
  }

  if (overrides.overrides !== undefined && base.overrides !== undefined) {
    (result as { overrides: T }).overrides = deepMerge(
      base.overrides as ConfigRecord,
      overrides.overrides as ConfigRecord,
      strategy,
    ) as T;
  }

  return result;
}
