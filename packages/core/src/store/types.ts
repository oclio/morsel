import type { MorselHook } from '@/hooks/types';
import type { ConfigMutability } from '@/load/merge-layers';
import type { DebugCallback } from '@/load/resolve-env';
import type { ArrayMergeStrategy } from '@/merge/deep-merge';
import type {
  MorselFormatPlugin,
  MorselValidationPlugin,
} from '@/plugins/types';

/**
 * Callback invoked when a watched dotted key changes.
 */
export type Listener = (next: unknown, prev: unknown) => void;

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
  readonly defaults?: T;
  /**
  Layer 4 — highest priority. Raw object, no extends or $env.
  */
  readonly overrides?: T;
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
  readonly formatPlugins?: MorselFormatPlugin[];
  /**
  Validation plugins. Default: [].
  Applied on the final config (post-merge), in order.
  Each plugin can validate and transform the config (coercion, defaults, strip).
  If a plugin throws → MorselValidationError. Boot: throw. Re-merge: catch + keep previous.
  */
  readonly validationPlugins?: MorselValidationPlugin[];
  /**
   * Hooks inserted into the pipeline at their lifecycle point.
   * Each hook produces a Record that becomes a layer.
   * Async hooks (Promise) → TypeError in loadConfigSync.
   * MorselWatchableHook → watchPaths watched by the core.
   */
  readonly hooks?: MorselHook[];
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
 * Immutable snapshot of a single resolved config layer.
 */
export interface MorselLayer {
  readonly source: 'defaults' | 'global' | 'project' | 'overrides' | 'hook';
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
  readonly layers: MorselLayer[];
}

/**
 * Public store returned by `watchConfig` — exposes config, layers, listeners, and stop.
 */
export interface MorselStore<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Merged config, always up-to-date via getter.
   *
   * In frozen mode: stable delegating proxy — same reference for life,
   * forwards all gets to the internal snapshot.
   * Frozen after stop() at the last state.
   */
  readonly config: T;
  /**
  Trace of resolved layers. Live during watch, frozen after stop(). Via getter.
  */
  readonly layers: MorselLayer[];
  /**
  Listen to a flat key (dotted notation). Returns unsubscribe.
  */
  on(key: string, listener: Listener): () => void;
  /**
  Stop watching, clean up listeners. Async.
  */
  stop(): Promise<void>;
}
