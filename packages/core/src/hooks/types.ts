/**
 * Hook lifecycle — 8 layer insertion points.
 *
 * Hooks `before:X` produce a layer that stacks **before** layer `X` (lower priority).
 * Hooks `after:X` produce a layer that stacks **after** layer `X` (higher priority).
 */
export type HookLifecycle =
  | 'before:defaults'
  | 'after:defaults'
  | 'before:global'
  | 'after:global'
  | 'before:project'
  | 'after:project'
  | 'before:overrides'
  | 'after:overrides';

/**
 * Context passed to a hook's `load` method.
 *
 * Stateless — a fresh context is created for each merge.
 * The hook must not store references to the context between merges.
 */
export interface HookContext {
  /**
  cwd resolved from options.
  */
  readonly cwd: string;
  /**
  envName resolved from options (process.env.NODE_ENV or explicit).
  */
  readonly envName: string | undefined;
  /**
  Request a re-merge of the store. No-op in loadConfig/loadConfigSync
  (no store lifecycle). In watchConfig, triggers a re-merge cycle.
  Safe to call multiple times — coalesced via re-merge in-progress and
  pending flags: if a re-merge is already running, subsequent calls set
  a pending flag and only one additional re-merge runs after the current
  one completes.
  */
  readonly triggerRemerge: () => void;
}

/**
 * Hook contract — inserts into the pipeline at a lifecycle point and produces a layer.
 *
 * The hook is stateless: the core calls `load` at each merge, no state between merges.
 * Sync (Record) or async (Promise<Record>). Async hooks throw TypeError in loadConfigSync.
 * If `load` throws → MorselError (code EHOOK).
 */
export interface LayerHook {
  /**
  Unique hook name, ex: "env", "package-json". Becomes hookName in MorselLayer.
  */
  readonly name: string;
  /**
  Insertion point in the pipeline.
  */
  readonly lifecycle: HookLifecycle;
  /**
   * Produce a Record inserted as a layer in the cascade.
   * Sync (Record) or async (Promise<Record>).
   * If throw → MorselError (code EHOOK).
   */
  load(
    context: HookContext,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * Called once after the store is created in watchConfig.
   * Use to open connections, start pollers, etc.
   * Not called in loadConfig/loadConfigSync (one-shot, no lifecycle).
   * If throw → MorselError (code EHOOK).
   */
  init?(context: HookContext): void | Promise<void>;
  /**
   * Called once when the store is stopped via stop().
   * Use to close connections, clear timers, etc.
   * Not called in loadConfig/loadConfigSync.
   * Errors are caught and logged via onDebug — do not block stop().
   */
  dispose?(): void | Promise<void>;
}

/**
 * Watchable hook — extends LayerHook with static watchPaths.
 *
 * The core watches these paths the same way as extends files:
 * collectWatchedFiles and collectDirectories include them.
 * watchPaths is static (the hook is stateless).
 */
export interface LayerWatchableHook extends LayerHook {
  /**
  Paths watched by the core. The core creates a watcher per directory.
  */
  readonly watchPaths: readonly string[];
}

/**
 * Union of all hook types accepted by `MorselOptions.hooks`.
 */
export type Hook = LayerHook | LayerWatchableHook;
