/**
 * Hook lifecycle — 8 insertion points in the pipeline.
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
  // Future: trigger() to request a re-merge (stateful hooks)
  // Future: state to persist between merges (stateful hooks)
}

/**
 * Hook contract — inserts into the pipeline at a lifecycle point and produces a layer.
 *
 * The hook is stateless: the core calls `load` at each merge, no state between merges.
 * Sync (Record) or async (Promise<Record>). Async hooks throw TypeError in loadConfigSync.
 * If `load` throws → MorselError (code EHOOK).
 */
export interface MorselHook {
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
}

/**
 * Watchable hook — extends MorselHook with static watchPaths.
 *
 * The core watches these paths the same way as extends files:
 * collectWatchedFiles and collectDirectories include them.
 * watchPaths is static (the hook is stateless).
 */
export interface MorselWatchableHook extends MorselHook {
  /**
  Paths watched by the core. The core creates a watcher per directory.
  */
  readonly watchPaths: readonly string[];
}
