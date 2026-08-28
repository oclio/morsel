import { vi } from 'vitest';

type ConfigRecord = Record<string, unknown>;

/**
 * Minimal structural mirror of `StoreState` from `@oclio/morsel`.
 *
 * Kept loose (unknown for options, unknown for layers) so that test-helpers
 * does not depend on the core package. Tests cast the result with
 * `as StoreState<T>` at the call site.
 */
export interface MockStoreState<T extends ConfigRecord = ConfigRecord> {
  _config: T;
  _proxy: T | undefined;
  _stoppedConfig: T | undefined;
  _layers: unknown[];
  options: unknown;
  listeners: Map<string, Set<unknown>>;
  wildcardListeners: Map<string, Set<unknown>>;
  stopped: boolean;
  watchers: Set<string>;
  watchedFiles: Map<string, Set<string>>;
  projectPath: string | undefined;
  lastConfig: ConfigRecord;
  remergeInProgress: boolean;
  remergeDone: Promise<void> | undefined;
  pendingRemerge: boolean;
  debounceTimers: Map<string, NodeJS.Timeout>;
  debounceMs: number;
  remerge: (store: unknown) => Promise<void>;
  enoentLogged: Set<string>;
}

/**
 * Create a mock `StoreState` with sensible defaults for unit tests.
 *
 * All fields can be overridden via the `overrides` parameter — the spread
 * happens last so caller values always win. The `overrides` type is loose
 * (`Record<string, unknown>`) to avoid friction with `exactOptionalPropertyTypes`
 * and the real `StoreState` type at the call site.
 *
 * @param overrides - Partial fields to override the defaults.
 * @returns A mock `StoreState`-like object.
 */
export function createMockStoreState<T extends ConfigRecord = ConfigRecord>(
  overrides: Record<string, unknown> = {},
): MockStoreState<T> {
  return {
    _config: {} as T,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    options: {},
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    ...overrides,
  };
}
