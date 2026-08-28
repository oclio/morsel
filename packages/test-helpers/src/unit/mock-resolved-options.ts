type ConfigRecord = Record<string, unknown>;

type ArrayMergeStrategy = 'replace' | 'concat';

type ConfigMutability = 'frozen' | 'mutable';

type DebugCallback = (...arguments_: unknown[]) => void;

/**
 * Minimal structural mirror of `ResolvedOptions` from `@oclio/morsel`.
 *
 * Kept loose (unknown for plugin/hook arrays) so that test-helpers does not
 * depend on the core package. Tests cast the result with `as ResolvedOptions`
 * at the call site.
 */
export interface MockResolvedOptions {
  name: string;
  cwd: string;
  defaults: ConfigRecord;
  overrides: ConfigRecord;
  globalDir: string;
  arrayMerge: ArrayMergeStrategy;
  envName: string | undefined;
  configMutability: ConfigMutability;
  verbose: boolean;
  onDebug: DebugCallback;
  formatPlugins: readonly unknown[];
  validationPlugins: readonly unknown[];
  hooks: readonly unknown[];
  watch: boolean;
  proxy: boolean;
}

/**
 * Create a mock `ResolvedOptions` with sensible defaults for unit tests.
 *
 * All fields can be overridden via the `overrides` parameter — the spread
 * happens last so caller values always win. The `overrides` type is loose
 * (`Record<string, unknown>`) to avoid friction with `exactOptionalPropertyTypes`
 * and the real `ResolvedOptions` type at the call site.
 *
 * @param overrides - Partial fields to override the defaults.
 * @returns A mock `ResolvedOptions`-like object.
 */
export function createMockResolvedOptions(
  overrides: Record<string, unknown> = {},
): MockResolvedOptions {
  return {
    name: 'myapp',
    cwd: '/project',
    defaults: {},
    overrides: {},
    globalDir: '/global',
    arrayMerge: 'replace',
    envName: 'test',
    configMutability: 'frozen',
    verbose: false,
    onDebug: () => {
      // noop debug callback
    },
    formatPlugins: [],
    validationPlugins: [],
    hooks: [],
    watch: true,
    proxy: true,
    ...overrides,
  };
}
