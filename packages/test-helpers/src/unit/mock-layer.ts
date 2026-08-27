type ConfigRecord = Record<string, unknown>;

type LayerSource = 'defaults' | 'global' | 'project' | 'overrides' | 'hook';

/**
 * Minimal structural mirror of both `MorselLayer` and `ResolvedLayer`.
 *
 * The two types from `@oclio/morsel` are structurally identical, so a single
 * helper covers both. Tests cast the result with `as MorselLayer` or
 * `as ResolvedLayer` at the call site.
 */
export interface MockLayer {
  source: LayerSource;
  path: string | undefined;
  config: ConfigRecord;
  exists: boolean;
  extendsPaths: string[];
  hookName?: string;
}

/**
 * Create a mock config layer with sensible defaults for unit tests.
 *
 * All fields can be overridden via the `overrides` parameter — the spread
 * happens last so caller values always win. The `overrides` type is loose
 * (`Record<string, unknown>`) to avoid friction with `exactOptionalPropertyTypes`
 * and the real `MorselLayer` / `ResolvedLayer` types at the call site.
 *
 * @param overrides - Partial fields to override the defaults.
 * @returns A mock layer object (compatible with `MorselLayer` and `ResolvedLayer`).
 */
export function createMockLayer(
  overrides: Record<string, unknown> = {},
): MockLayer {
  return {
    source: 'project',
    path: '/project/config.json',
    config: {},
    exists: true,
    extendsPaths: [],
    ...overrides,
  };
}
