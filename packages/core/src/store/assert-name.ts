import type { MorselHook } from '@/hooks/types';
import type { ConfigMutability } from '@/load/merge-layers';
import type { DebugCallback } from '@/load/resolve-env';
import type { ArrayMergeStrategy } from '@/merge/deep-merge';
import { resolveGlobalDirectory } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type {
  MorselFormatPlugin,
  MorselValidationPlugin,
} from '@/plugins/types';
import type { MorselOptions } from '@/store/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Fully resolved options with all fields populated by {@link resolveOptions}.
 */
export interface ResolvedOptions {
  readonly name: string;
  readonly cwd: string;
  readonly defaults: ConfigRecord;
  readonly overrides: ConfigRecord;
  readonly globalDir: string;
  readonly arrayMerge: ArrayMergeStrategy;
  readonly envName: string | undefined;
  readonly configMutability: ConfigMutability;
  readonly verbose: boolean;
  readonly onDebug: DebugCallback;
  readonly formatPlugins: MorselFormatPlugin[];
  readonly validationPlugins: MorselValidationPlugin[];
  readonly hooks: MorselHook[];
}

const VALID_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Validate the `name` option.
 *
 * @throws TypeError if name is missing, empty, or does not start with a letter
 * and contain only letters, digits, dashes, or underscores.
 * @param name - The name to validate.
 */
function assertName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name === '') {
    throw new TypeError('morsel: name is required');
  }
  if (!VALID_NAME.test(name)) {
    throw new TypeError(
      'morsel: name must start with a letter and contain only letters, digits, dashes, or underscores',
    );
  }
}

/**
 * Default debug callback — does nothing.
 */
export const noop = (): undefined => undefined;

/**
 * Apply defaults and validate options.
 *
 * @param options - The raw options from the consumer.
 * @returns Resolved options with all fields populated.
 */
export function resolveOptions<
  T extends Record<string, unknown> = ConfigRecord,
>(options: MorselOptions<T>): ResolvedOptions {
  assertName(options.name);

  return {
    name: options.name,
    cwd: options.cwd ?? process.cwd(),
    defaults: (options.defaults ?? {}) as ConfigRecord,
    overrides: (options.overrides ?? {}) as ConfigRecord,
    globalDir:
      options.globalDir ?? resolveGlobalDirectory({ name: options.name }),
    arrayMerge: options.arrayMerge ?? 'replace',
    envName: options.envName ?? process.env['NODE_ENV'],
    configMutability: options.configMutability ?? 'frozen',
    verbose: options.verbose ?? false,
    onDebug: options.onDebug ?? noop,
    formatPlugins: options.formatPlugins ?? [jsonPlugin],
    validationPlugins: options.validationPlugins ?? [],
    hooks: options.hooks ?? [],
  };
}
