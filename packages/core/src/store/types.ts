import type { LayerHook, LayerWatchableHook } from '@/hooks/types';
import type { ConfigMutability } from '@/load/merge-layers';
import type { DebugCallback } from '@/load/resolve-env';
import type { LayerSource } from '@/load/resolve-layer';
import type { ArrayMergeStrategy } from '@/merge/deep-merge';
import type { ChangeCategory } from '@/merge/diff-keys';
import type { FormatPlugin, ValidationPlugin } from '@/plugins/types';

/**
 * Generic configuration object record with unknown values.
 */
export type ConfigRecord = Record<string, unknown>;

/**
 * Event object passed to a listener when a watched dotted key changes.
 */
export interface MorselChangeEvent {
  readonly keyPath: string;
  readonly type: ChangeCategory;
  readonly next: unknown;
  readonly prev: unknown;
}

/**
 * Options for future use by `store.on()`.
 *
 * Reserved but not yet implemented. Future options may include:
 * - `once: true` — auto-unsubscribe after first event
 * - `signal: AbortSignal` — unsubscribe via AbortController
 * - `includeChildren: boolean` — emit for child key changes
 */
export type MorselListenerOptions = Record<string, never>;

/**
 * Callback invoked when a watched dotted key changes.
 */
export type Listener = (event: MorselChangeEvent) => void;

/**
 * User-facing options for `loadConfig` and `watchConfig`.
 */
export interface MorselOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
  Base name, ex: "myapp". Required, alphanumeric.
  */
  readonly name: string;
  /**
  Default: process.cwd()
  */
  readonly cwd?: string;
  /**
  Layer 1 — lowest priority. Raw object, no extends or $env.
  */
  readonly defaults?: Partial<T> | Record<string, unknown>;
  /**
  Layer 4 — highest priority. Raw object, no extends or $env.
  */
  readonly overrides?: Partial<T> | Record<string, unknown>;
  /**
  Default: ~/.config/morsel
  */
  readonly globalDir?: string;
  /**
  Default: 'replace'. 'concat' to concatenate arrays.
  */
  readonly arrayMerge?: ArrayMergeStrategy;
  /**
  Default: process.env.NODE_ENV. Pinned if explicit string, live if implicit.
  */
  readonly envName?: string;
  /**
  Default: 'frozen'. 'mutable' = plain mutable object.
  */
  readonly configMutability?: ConfigMutability;
  /**
  Default: false. Log everything on stderr/onDebug.
  */
  readonly verbose?: boolean;
  /**
  Custom debug logger. Use an empty function for total silence.
  */
  readonly onDebug?: DebugCallback;
  /**
  Format plugins. Default: [jsonPlugin].
  Order = match priority by extension.
  First plugin whose extensions include path.extname(filePath) wins.
  */
  readonly formatPlugins?: readonly FormatPlugin[];
  /**
  Validation plugins. Default: [].
  Applied on the final config (post-merge), in order.
  Each plugin can validate and transform the config (coercion, defaults, strip).
  If a plugin throws → ValidationError. Boot: throw. Re-merge: catch + keep previous.
  */
  readonly validationPlugins?: readonly ValidationPlugin[];
  /**
   * Hooks inserted into the pipeline at their lifecycle point.
   * Each hook produces a Record that becomes a layer.
   * Async hooks (Promise) → TypeError in loadConfigSync.
   * LayerWatchableHook → watchPaths watched by the core.
   */
  readonly hooks?: readonly (LayerHook | LayerWatchableHook)[];
}

/**
 * Options for `watchConfig` — extends {@link MorselOptions} with watch-specific settings.
 */
export interface WatchOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends MorselOptions<T> {
  /**
  Default: 300. Watch debounce in ms.
  */
  readonly watchDebounce?: number;
}

/**
 * Target layer for set and mutate operations.
 */
export type StoreTarget = 'global' | 'project';

/**
 * Target layer(s) for delete operations. Use `'all'` to delete from every writable layer.
 */
export type DeleteTarget = 'all' | 'global' | 'project';

/**
 * Immutable snapshot of a single resolved config layer.
 */
export interface MorselLayer {
  readonly configName: string;
  readonly source: LayerSource;
  /**
  Present only if source === 'hook'. Name of the hook.
  */
  readonly hookName?: string;
  readonly path: string | undefined;
  readonly config: Readonly<Record<string, unknown>>;
  readonly exists: boolean;
  /**
  Resolved extends paths for this layer (file layers only).
  Empty for defaults/overrides/hooks.
  */
  readonly extendsPaths: readonly string[];
}

/**
 * Result of a one-shot config load: merged config and resolved layers.
 */
export interface ConfigResult<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly config: T;
  readonly layers: readonly MorselLayer[];
}

/**
 * Live configuration store returned by `watchConfig`.
 */
export interface MorselStore<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly config: T;
  readonly layers: readonly MorselLayer[];
  /**
  Listen to a flat key (dotted notation). Supports wildcard patterns:
  `foo.*` matches any direct child of `foo`, `**` matches any key.
  Returns unsubscribe.
  */
  on(
    key: string,
    listener: Listener,
    options?: MorselListenerOptions,
  ): () => void;
  /**
  Read a value by dot or bracket path, returning defaultValue if undefined.
  */
  get<V = unknown>(
    path: string | readonly (string | number)[],
    defaultValue?: V,
  ): V;
  /**
  Check if a key exists and has a defined value.
  */
  has(path: string | readonly (string | number)[]): boolean;
  /**
  Mutate a key by path and persist to source file (alias of mutateKey).
  */
  set(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<void>;
  /**
  Delete a key by path and persist deletion to source file (alias of deleteKey).
  */
  unset(
    path: string | readonly (string | number)[],
    target?: DeleteTarget,
  ): Promise<boolean>;
  /**
  Return a complete clone snapshot of the entire merged configuration.
  */
  all(): T;
  /**
  Flatten the configuration into a 1D Record of dotted paths to leaf values.
  */
  dotify(): Record<string, unknown>;
  /**
  Mutate a key by path and persist to source file.
  */
  mutateKey(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<void>;
  /**
  Delete a key by path and persist deletion to source file.
  */
  deleteKey(
    path: string | readonly (string | number)[],
    target?: DeleteTarget,
  ): Promise<boolean>;
  /**
  Push a value onto the end of an array key. Returns the new element's index.
  */
  push(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<number>;
  /**
  Unshift a value onto the beginning of an array key. Returns 0.
  */
  unshift(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<number>;
  /**
  Pop the last element from an array key. Returns the removed value.
  */
  pop(
    path: string | readonly (string | number)[],
    target?: StoreTarget,
  ): Promise<unknown>;
  /**
  Shift the first element from an array key. Returns the removed value.
  */
  shift(
    path: string | readonly (string | number)[],
    target?: StoreTarget,
  ): Promise<unknown>;
  /**
  Splice an array key: remove and/or insert elements. Returns the removed elements.
  */
  splice(
    path: string | readonly (string | number)[],
    start: number,
    deleteCount: number,
    ...items: unknown[]
  ): Promise<unknown[]>;
  /**
  Find the first index of a value in an array key. Returns -1 if absent.
  */
  indexOf(path: string | readonly (string | number)[], value: unknown): number;
  /**
  Find the last index of a value in an array key. Returns -1 if absent.
  */
  lastIndexOf(
    path: string | readonly (string | number)[],
    value: unknown,
  ): number;
  /**
  Stop watching, clean up listeners. Async.
  */
  stop(): Promise<void>;
}
