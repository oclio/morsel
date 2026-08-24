# SPEC-MORSEL-1.1.0: Pluggable Cascading Config Loader with Watch

| Metadata            | Value                                                            |
| :------------------ | :--------------------------------------------------------------- |
| **Package**         | `@oclio/morsel`                                                  |
| **Author**          | @oclio                                                           |
| **Status**          | `STABLE`                                                         |
| **Spec version**    | `1.1.0`                                                          |
| **Created**         | 2026-08-23                                                       |
| **Target runtimes** | Node.js >= 18                                                    |
| **Architecture**    | See [`DESIGN.md`](./DESIGN.md) for design choices and principles |

---

## 1. Normative Invariants

1. **Pluggable architecture**: parsing is provided by format plugins (`FormatPlugin`). The core provides `jsonPlugin` by default. No format is hardcoded in the core — `JSON.parse` lives in `jsonPlugin`, not in `loadFile`. Pipeline extensibility is provided by hooks (`LayerHook`, `EventHook`) that insert at specific lifecycle points or react to events.
2. **Zero runtime dependencies**: `node:fs`, `node:path`, `node:os` only. No external packages.
3. **Watch resilience, one-shot throw**: `loadConfig`/`loadConfigSync` throw `MorselError` on fs or parse errors. `watchConfig` throws `MorselError` if the initial load (first pass) fails — there is no "last valid state" at boot. For subsequent re-merges (fs.watch fire), `watchConfig` catches internally, keeps the last valid state, logs the error to `stderr`, and routes to `onDebug` (noop by default). Programming errors (`name` missing, `name` invalid, `on()` after `stop()`) throw in both modes.
4. **Reserved keyword cleanup**: `extends` and `$env` are **absolute reserved keywords** of the engine — they cannot be used as business keys in the final config. They are stripped from each layer before inter-layer merge. Never present in the final `config`. If an application needs a key named `$env` or `extends` for business purposes, it must be renamed (`$envConfig`, `extendsList`, etc.).
5. **Sync-first & distinct async**: `loadConfigSync` is synchronous, `loadConfig` and `watchConfig` are async. No `watch: true/false` option — the chosen function determines the behavior. Async `loadConfig` avoids blocking the event loop during reads — useful for apps that load multiple configs in parallel with `Promise.all`. `watchConfig` is async because boot performs reads (`readFile`) before setting up watchers.
6. **Watch ref-counting**: a single `fs.watch` per directory, shared across all stores. Closed when the last store calls `stop()`. Includes directories of `extends` files and `watchPaths` of watchable hooks — a change in an inherited file triggers a re-merge.
7. **Parsing / semantics separation**: the plugin parses raw content → `Record<string, unknown>`. Semantic concepts (`extends`, `$env`, cleanup) are core. The plugin knows nothing about `extends` or `$env`.
8. **Lifecycle hooks**: layer hooks (`LayerHook`) insert at 8 pipeline points (before/after for each layer). A layer hook produces a `Record` that becomes a layer in the cascade. Stateless — the core calls the hook on each merge, no state between merges. Event hooks (`EventHook`) react to lifecycle events (e.g. `after:write`) without producing a layer — they are side-effect only (logging, metrics, audit).
9. **Native path parsing & prototype protection**: the core provides robust path parsing supporting dot notation (`a.b.c`), indexed arrays (`users[0].name`, `users.0.name`), and escaped dots (`app\.config.host`). Any attempt to access or mutate `__proto__`, `constructor`, or `prototype` is rejected (`TypeError`).
10. **Transactional mutation & optimistic write**: `mutateKey` and `deleteKey` update the in-memory config optimistically, emit key-level change events, and persist changes via atomic read-modify-write on the source layer. Writes are serialized per file path. In case of I/O or serialization failure, the in-memory state is automatically rolled back, revert events are emitted, and a `MorselError` (`EWRITE`) is thrown. After a successful write, `after:write` event hooks (`EventHook`) are triggered with a `WriteEvent` — errors in these hooks are caught and logged via `onDebug`, they do not roll back the mutation.

---

## 2. Detailed Pipeline

> **Semantics:** `config` is the merged result of layers. `layers` is the trace of resolved layers (4 core entries minimum + 1 entry per active hook, even if `exists: false`). Reserved keys (`extends`, `$env`) are never present in `config` or in `layer.config`.

### Step 0 — Validation

`assertName(opts.name)` — throws `TypeError('morsel: name is required')` if missing, `TypeError('morsel: name must start with a letter and contain only letters, digits, dashes, or underscores')` if invalid. `resolveOptions(opts)` applies defaults (`cwd = process.cwd()`, `globalDir = ~/.config/<name>`, `arrayMerge = 'replace'`, `configMutability = 'frozen'`, `envName = process.env.NODE_ENV`). If `NODE_ENV` is not set in the environment, `envName` becomes `undefined` — this is a legitimate case (local dev without env management). If a file contains `$env` in this case, morsel warns via `onDebug` (or stderr if `onDebug` is not provided) and ignores the `$env` block.

### Step 1 — Layer Resolution

Layers resolved independently, with hooks interleaved (4 core layers + hook layers):

- `[hooks before:defaults]`: for each hook with `lifecycle: 'before:defaults'`, `hook.load(ctx)` → `Record`. Result inserted as layer (`source: 'hook'`, `hookName: hook.name`).
- `defaults`: raw object passed as option. `$env` resolved according to `envName`, `extends` silently stripped (no throw, no warn). `path: undefined`, `exists: true`.
- `[hooks after:defaults]`: same, `lifecycle: 'after:defaults'`.
- `[hooks before:global]`: same.
- `global`: `resolveGlobalPath` (async) / `resolveGlobalPathSync` (sync) builds candidates from plugin extensions (`formatPlugins.flatMap(p => p.extensions)`), existence check on each (`fs.promises.access` in async, `existsSync` in sync), first match wins. If found → `loadFile(globalPath, formatPlugins)` (plugin parsing + `resolveExtends` + cleanup). If none → `exists: false`, `config: {}`.
- `[hooks after:global]`: same.
- `[hooks before:project]`: same.
- `project`: `resolveProjectPath` (async) / `resolveProjectPathSync` (sync) in `cwd`. Same as `global`.
- `[hooks after:project]`: same.
- `[hooks before:overrides]`: same.
- `overrides`: raw object passed as option. Same as `defaults`.
- `[hooks after:overrides]`: same.

### Step 2 — Merge & Validation

1. `mergeLayers(allLayers, arrayMerge)` — recursive deep merge of all resolved layers in order (hooks included).
2. `interpolate(merged)` — resolve `${VAR}` from `process.env` and `{{ref.path}}` cross-references within the merged config. Circular references throw `MorselError` with code `ECYCLE`.
3. `applyValidation(config, validationPlugins)` — if `validationPlugins` is provided, each plugin validates and returns the transformed config. In one-shot and watch boot: throws `ValidationError` if validation fails. In watch re-merge: caught, logged to `onDebug`/stderr, keeps previous config.

### Step 3 — Mutability & Result

1. `applyMutability(config, configMutability)` — if `'frozen'` (default): recursive `Object.freeze`. If `'mutable'`: plain mutable object.
2. Conversion of each `ResolvedLayer` to frozen `MorselLayer` (public audit trace).
3. Returns `ConfigResult<T> { config, layers }`.

---

## 3. Dependencies & Technical Constraints

### 3.1 Used APIs

- `node:fs`: `readFile`, `readFileSync`, `access`, `existsSync`, `watch`, `writeFileSync`, `mkdirSync`, `renameSync`
- `node:fs/promises`: `readFile`, `access`, `writeFile`, `mkdir`, `rename`
- `node:path`: `resolve`, `dirname`, `extname`, `basename`
- `node:os`: `homedir`

### 3.2 External Dependencies

**None.** The `package.json` has `dependencies: {}`.

### 3.3 Compatibility Constraints

- Node.js >= 18.0.0
- ESM and CJS natively supported via dual build (`tsup`)

---

## 4. API Contract & Interfaces

### 4.1 Public Types & Interfaces

```typescript
export interface MorselOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name: string;
  readonly cwd?: string;
  readonly globalDir?: string;
  readonly defaults?: Partial<T> | Record<string, unknown>;
  readonly overrides?: Partial<T> | Record<string, unknown>;
  readonly formatPlugins?: readonly FormatPlugin[];
  readonly validationPlugins?: readonly ValidationPlugin[];
  readonly hooks?: readonly Hook[];
  readonly arrayMerge?: ArrayMergeStrategy;
  readonly configMutability?: ConfigMutability;
  readonly envName?: string;
  readonly verbose?: boolean;
  readonly onDebug?: DebugCallback;
}

export interface WatchOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends MorselOptions<T> {
  readonly watchDebounce?: number;
}

export type StoreTarget = 'global' | 'project';
export type DeleteTarget = 'all' | 'global' | 'project';

export interface MorselStore<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly config: T;
  readonly layers: readonly MorselLayer[];
  on(
    keyPath: string,
    listener: Listener,
    options?: ListenerOptions,
  ): () => void;
  get<V = unknown>(
    path: string | readonly (string | number)[],
    defaultValue?: V,
  ): V;
  has(path: string | readonly (string | number)[]): boolean;
  set(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<void>;
  unset(
    path: string | readonly (string | number)[],
    target?: DeleteTarget,
  ): Promise<boolean>;
  all(): T;
  dotify(): Record<string, unknown>;
  mutateKey(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<void>;
  deleteKey(
    path: string | readonly (string | number)[],
    target?: DeleteTarget,
  ): Promise<boolean>;
  push(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<number>;
  unshift(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: StoreTarget,
  ): Promise<number>;
  pop(
    path: string | readonly (string | number)[],
    target?: StoreTarget,
  ): Promise<unknown>;
  shift(
    path: string | readonly (string | number)[],
    target?: StoreTarget,
  ): Promise<unknown>;
  splice(
    path: string | readonly (string | number)[],
    start: number,
    deleteCount: number,
    ...items: unknown[]
  ): Promise<unknown[]>;
  indexOf(path: string | readonly (string | number)[], value: unknown): number;
  lastIndexOf(
    path: string | readonly (string | number)[],
    value: unknown,
  ): number;
  stop(): Promise<void>;
}

export interface MorselLayer {
  readonly configName: string;
  readonly source: LayerSource;
  readonly path: string | undefined;
  readonly config: Readonly<Record<string, unknown>>;
  readonly exists: boolean;
  readonly extendsPaths: readonly string[];
  readonly hookName?: string;
}

export class MorselError extends Error {
  readonly path: string | undefined;
  readonly code: ErrorCode;
  override readonly cause: NodeJS.ErrnoException | Error;
}

export class WriteError extends MorselError {
  readonly filePath: string;
  readonly mutation: MutationOperation;
}

export type ErrorCode =
  'EIO' | 'EPARSE' | 'ENOPLUGIN' | 'EVALIDATE' | 'ECYCLE' | 'EHOOK' | 'EWRITE';

export class NoPluginError extends MorselError {
  readonly extension: string;
}

export class ValidationError extends MorselError {
  readonly issues: Readonly<Record<string, string>>;
}

export interface FormatPlugin {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string, filePath: string): Record<string, unknown>;
  serialize(data: Record<string, unknown>): string;
}

export interface ValidationPlugin {
  readonly name: string;
  validate(config: Record<string, unknown>): Record<string, unknown>;
}

export interface LayerHook {
  readonly name: string;
  readonly lifecycle: HookLifecycle;
  load(
    ctx: HookContext,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface LayerWatchableHook extends LayerHook {
  readonly watchPaths: readonly string[];
}

export interface WriteEvent {
  readonly filePath: string;
  readonly keyPath: string;
  readonly mutation: MutationOperation;
}

export interface EventHook {
  readonly name: string;
  readonly lifecycle: 'after:write';
  onWrite(event: WriteEvent): void | Promise<void>;
}

export type Hook = LayerHook | LayerWatchableHook | EventHook;

export type HookLifecycle =
  | 'before:defaults'
  | 'after:defaults'
  | 'before:global'
  | 'after:global'
  | 'before:project'
  | 'after:project'
  | 'before:overrides'
  | 'after:overrides'
  | 'after:write';

export interface HookContext {
  readonly cwd: string;
  readonly envName: string | undefined;
}

export interface ConfigResult<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly config: T;
  readonly layers: readonly MorselLayer[];
}

export interface ResolvedPaths {
  readonly global: string;
  readonly project: string;
}

export interface ResolvePathsOptions {
  readonly name: string;
  readonly cwd?: string;
  readonly globalDir?: string;
}

export type LayerSource =
  'defaults' | 'global' | 'project' | 'overrides' | 'hook';
export type ArrayMergeStrategy = 'replace' | 'concat';
export type ConfigMutability = 'frozen' | 'mutable';
export type ChangeCategory = 'added' | 'modified' | 'removed';

export interface KeyChange {
  readonly next: unknown;
  readonly prev: unknown;
  readonly category: ChangeCategory;
}

export interface ChangeEvent {
  readonly keyPath: string;
  readonly type: ChangeCategory;
  readonly next: unknown;
  readonly prev: unknown;
}

export type ListenerOptions = Record<string, never>;

export type Listener = (event: ChangeEvent) => void;
export type DebugCallback = (
  message: string,
  context?: Record<string, unknown>,
) => void;

export type ConfigRecord = Record<string, unknown>;
```

---

### 4.2 Normative Internal Interfaces

```typescript
/**
 * Discriminated union indicating whether a file was found and parsed on disk.
 */
export type LoadFileResult =
  | { readonly exists: true; readonly config: ConfigRecord }
  | { readonly exists: false; readonly config: Record<string, never> };

/**
 * Complete resolved layer including traceability metadata.
 */
export interface ResolvedLayer {
  readonly source: LayerSource;
  readonly path: string | undefined;
  readonly exists: boolean;
  readonly config: ConfigRecord;
  readonly extendsPaths: string[];
  readonly hookName?: string;
}

/**
 * Complete resolved options with default values applied.
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
  readonly formatPlugins: readonly FormatPlugin[];
  readonly validationPlugins: readonly ValidationPlugin[];
  readonly hooks: readonly Hook[];
}

/**
 * Internal shared state of a reactive store.
 */
export interface StoreState<T extends ConfigRecord = ConfigRecord> {
  _config: T;
  _proxy: T | undefined;
  _stoppedConfig: T | undefined;
  _layers: MorselLayer[];
  options: ResolvedOptions;
  listeners: Map<string, Set<Listener>>;
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
  remerge: (store: StoreState) => Promise<void>;
  enoentLogged: Set<string>;
}
```

---

### 4.3 Public Signatures

```typescript
export function loadConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options: MorselOptions<T>): Promise<ConfigResult<T>>;

export function loadConfigSync<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options: MorselOptions<T>): ConfigResult<T>;

export function watchConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options: WatchOptions<T>): Promise<MorselStore<T>>;

export function resolvePaths(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): ResolvedPaths;

// All path resolution functions (resolvePaths, resolveProjectPath,
// resolveProjectPathSync, resolveGlobalPath, resolveGlobalPathSync)
// throw TypeError('morsel: formatPlugins must not be empty') if
// formatPlugins is an empty array.

export function initConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options: {
  name: string;
  cwd?: string;
  content?: T;
  fallbackContent?: T;
  formatPlugins?: readonly FormatPlugin[];
}): string;

export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  strategy: ArrayMergeStrategy,
): Record<string, unknown>;

export function diffKeys(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Map<string, KeyChange>;

export function flatten(obj: Record<string, unknown>): Map<string, unknown>;

export function defineConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options: MorselOptions<T>): MorselOptions<T>;

export function mergeConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  base: MorselOptions<T>,
  overrides: Partial<MorselOptions<T>>,
): MorselOptions<T>;

// Path utilities

export type PathSegment = string | number;

export function parsePath(
  path: string | readonly (string | number)[],
): PathSegment[];

export function validatePath(segments: readonly PathSegment[]): void;

export function getPathValue(
  target: unknown,
  path: string | readonly PathSegment[],
): unknown;

export function setPathValue(
  target: Record<string, unknown> | unknown[],
  path: string | readonly PathSegment[],
  value: unknown,
): void;

export function hasRemovedPathValue(
  target: Record<string, unknown> | unknown[],
  path: string | readonly PathSegment[],
): boolean;

export function dotifyObject(
  object: unknown,
  prefix?: string,
  result?: Record<string, unknown>,
): Record<string, unknown>;

// Format plugin

export const jsonPlugin: FormatPlugin;

// Writer internals

export interface MutationOperation {
  readonly path: string;
  readonly value?: unknown;
  readonly isDelete?: boolean;
}

export interface KeyOrigin {
  readonly layer: MorselLayer | undefined;
  readonly filePath: string | undefined;
  readonly isWritable: boolean;
  readonly exists: boolean;
}

/**
 * Entry in the global watcher registry (ref-counting and retry timer).
 * Exported for typing `getRegistry()` return values.
 */
export interface WatcherEntry {
  watcher: fs.FSWatcher | undefined;
  refCount: number;
  stores: Set<StoreState>;
  retryTimer: NodeJS.Timeout | undefined;
}

export type WatcherRegistry = Map<string, WatcherEntry>;

/**
 * Test/internal helpers exposed for WatcherRegistry inspection.
 */
export function getRegistry(): WatcherRegistry;
export function clearRegistry(): void;
```

---

### 4.4 Semantics

#### `initConfig`

1. Checks if the configuration file already exists via `resolveProjectPathSync`. If yes → returns the existing path without modifying anything (idempotence).
2. If no: `mkdirSync(dirname, { recursive: true })` — creates the parent directory if needed.
3. Writes `content` (or `fallbackContent`, or `{}`) as JSON via atomic write: `writeFileSync` to `<path>.tmp` then `renameSync` to `<path>` (avoids partial reads in case of crash).
4. Returns the created path.
5. On write failure (`writeFileSync` or `renameSync` throws): throws `MorselError` (`EIO`) with the project path and original error as cause.

#### `stop()`

`stop()` is async (`Promise<void>`). `stopped = true` is assigned **synchronously** at the start, before any `await`. Watchers whose `refCount` reaches zero are closed. All registered listeners are cleared. `store.config` and `store.layers` remain readable after stop at the last known state. Any subsequent call to `store.on()` throws `Error('morsel: store is stopped')`.

#### `writeConfigFile` — Atomic Write Engine

`writeConfigFile` performs an atomic read-modify-write on a config file:

1. Reads the existing file content. If the file does not exist (ENOENT), treats the content as empty and proceeds — the file will be created.
2. Parses the existing content via the matching format plugin (or `{}` if empty).
3. Applies the mutation (`set` or `delete`) to the parsed config.
4. Serializes the result via the plugin's `serialize` method.
5. Writes to a temporary file (`<path>.tmp`), then atomically renames to the target path.
6. Writes are serialized per file path via a promise queue — concurrent mutations to the same file are queued.

On I/O or serialization failure, a `MorselError` (`EWRITE`) is thrown. The caller (`mutateKey`/`deleteKey`) is responsible for rolling back the in-memory state.

#### `DeleteTarget: 'all'`

When `unset` or `deleteKey` is called with `target: 'all'` (the default), the deletion is applied to **every writable layer** that has a file path — both `project` and `global`. The key is removed from each file in sequence via `writeConfigFile`. If the key does not exist in the in-memory config, the operation returns `false` without writing. Rollback applies to all files if any write fails.

---

### 4.5 Events & Two-Phase Ordering

Events are computed via `diffKeys` and emitted via `store.on(keyPath, listener, options?)`:

- **Scalar modified**: `event = { keyPath, type: 'modified', next: value, prev: oldValue }`.
- **Scalar added**: `event = { keyPath, type: 'added', next: value, prev: undefined }`.
- **Scalar removed**: `event = { keyPath, type: 'removed', next: undefined, prev: oldValue }`.
- **Object → object (same type)**: recursive descent, emits modified child scalars.
- **Object replaced by scalar**: `event = { keyPath, type: 'modified', next: scalar, prev: oldObject }` on the parent + all child scalars as removed.
- **Scalar replaced by object**: `event = { keyPath, type: 'modified', next: newObject, prev: scalar }` on the parent + all child scalars as added.
- **Object added / removed**: emits on the parent + all child scalars.
- **Array modified**: `event = { keyPath, type: 'modified', next: newArray, prev: oldArray }` on the parent (atomic replacement, no per-index diff). Array mutators (`push`, `unshift`, `pop`, `shift`, `splice`) delegate to `mutateKey` with the full replacement array. `push` additionally emits on `path.<newIndex>` for the newly added element. Type mismatch (target is not an array) throws `MorselError` (`EVALIDATE`).

#### Two-Phase Ordering Invariant

Flat keys are emitted in two strict phases:

1. **Phase 1: Deletions — Bottom-Up (deepest to shallowest)**: removed child keys are emitted **before** the parent key that changes type. Order: decreasing depth, then **descending** alphabetical order at the same depth.
2. **Phase 2: Additions and modifications — Top-Down (shallowest to deepest)**: modified/added parent keys are emitted **before** child keys. Order: increasing depth, then **ascending** alphabetical order at the same depth.

Wildcard patterns are supported in `store.on()`:

- `foo.*` — matches any direct child of `foo` (one segment).
- `**` — matches any key at any depth.
- `foo.**` — matches `foo` and any descendant of `foo` (zero or more segments).

Wildcard listeners are emitted after exact-match listeners for each key, within the same phase.

---

## 5. Error Handling

### 5.1 Error Types

- **`fs` (EACCES, EBUSY, EMFILE, disk full)** — One-shot: throws `MorselError`. Watch: caught → `onDebug`/stderr, continues.
- **`fs` (ENOENT, file absent)** — Normal flow: `exists: false`, `config: {}`. Not an error.
- **`fs` (ENOENT during a watch re-merge)** — If a `global` or `project` layer that previously existed (`exists: true` in `store._layers`) disappears during a re-merge, the re-merge is short-circuited: the config stays frozen at the last valid state (`lastConfig`), `onDebug` is called once with `{ code: 'ENOENT', sources: [<source>] }` (duplicates suppressed via `enoentLogged` until the file reappears). Watchers remain active.
- **`parse` (invalid content on an existing file)** — One-shot: throws `MorselError` (`EPARSE`). Watch boot: throws. Re-merge: caught, keeps previous config, `onDebug`/stderr, no event.
- **`plugin` (no plugin for the extension)** — One-shot: throws `NoPluginError` (`ENOPLUGIN`). Watch boot: throws. Re-merge: caught, keeps previous config, `onDebug`/stderr.
- **`validation` (validation fail)** — One-shot: throws `ValidationError` (`EVALIDATE`). Watch boot: throws. Re-merge: caught, keeps previous config, `onDebug`/stderr.
- **`cycle` (circular `extends`, `visited` Set + `MAX_DEPTH = 10`)** — One-shot: throws `MorselError` (`ECYCLE`). Watch boot: throws. Re-merge: caught, keeps previous config, `onDebug`/stderr.
- **`hook` (hook throws in `load()`)** — One-shot: throws `MorselError` (`EHOOK`). Watch boot: throws. Re-merge: caught, keeps previous config, `onDebug`/stderr.
- **`hook async` (hook returns a Promise in `loadConfigSync`)** — Throws `TypeError('morsel: hook "<name>" is async — use loadConfig or watchConfig')`. Programming error.
- **`env` (`$env` present but `envName` undefined)** — Warns `onDebug` only (not stderr), `$env` ignored. Same in one-shot and watch.
- **`program` (`name` missing, `name` invalid, `on()` after `stop()`)** — Throws `TypeError`/`Error`. Same in one-shot and watch.

### 5.2 Priority & Debug Channels

1. **stderr by default**: morsel logs severe cases (invalid JSON on an existing file) to `process.stderr`.
2. **`onDebug`**: if provided, morsel routes all messages there instead of stderr (`onDebug: () => {}` for total silence).
3. **`verbose: true`**: full logging (IO retry, watch crash, timers) to the active channel.

### 5.3 Retry & Re-attachment (Directory Deletion)

- When a watched directory is deleted (`rm -rf`), `fs.watch` emits a crash.
- morsel triggers periodic reconnection polling: `existsSync(dir)` every 1 second via a `retryTimer`.
- As soon as the directory reappears, `createWatcher` re-instantiates `fs.watch` and a full re-merge is triggered.

### 5.4 `ENOPLUGIN` Error Messages

`NoPluginError` includes a generic hint guiding the user to register a plugin:

- With extension (`.yaml`): `morsel: ENOPLUGIN — no format plugin found for .yaml. Register a FormatPlugin via options.formatPlugins. (/path/to/myapp.config.yaml)`
- No extension: `morsel: ENOPLUGIN — file has no extension. Register a FormatPlugin via options.formatPlugins. (/path/to/myapp.config)`

The core does not recommend any specific plugin package — the plugin architecture is open and extensible.

---

## 6. Concurrency & Parallelism

### 6.1 Model

- **No pool**: sequential layer reads in lifecycle order.
- **Watch ref-counting**: a single `fs.watch` per unique directory (`WatcherRegistry`).
- **Concurrent re-merges**: handled by an atomic queue without blocking mutex via `pendingRemerge`.

### 6.2 Watcher Registry — Reference Algorithm

```text
createWatcher(directoryPath, store):
  if registry.has(directoryPath):
    entry = registry.get(directoryPath)
    entry.refCount++
    entry.stores.add(store)
  else:
    watcher = fs.watch(directoryPath, (eventType, filename) => handleWatchEvent(registry, directoryPath, filename))
    entry = { watcher, refCount: 1, stores: new Set([store]), retryTimer: undefined }
    registry.set(directoryPath, entry)
  return entry

releaseWatcher(directoryPath, store):
  entry = registry.get(directoryPath)
  if not entry: return
  entry.stores.delete(store)
  entry.refCount--
  if entry.refCount === 0:
    if entry.retryTimer: clearTimeout(entry.retryTimer)
    entry.watcher.close()
    registry.delete(directoryPath)

handleWatchEvent(registry, directoryPath, filename):
  entry = registry.get(directoryPath)
  if not entry: return
  if not filename:
    // Wildcard fallback if the OS does not provide the filename
    for store in entry.stores:
      if not store.watchedFiles.get(directoryPath): continue
      triggerDebouncedRemerge(store, `${directoryPath}:*:${store.projectPath}`)
    return
  fullPath = path.resolve(directoryPath, filename)
  for store in entry.stores:
    if not store.watchedFiles.get(directoryPath)?.has(filename): continue
    triggerDebouncedRemerge(store, `${fullPath}:${store.projectPath}`)
```

### 6.3 Concurrent Re-Merge — Reference Algorithm

```text
fs.watch fire (after debounce):
  if store.stopped: return
  if store.remergeInProgress:
    store.pendingRemerge = true
    return
  store.remergeInProgress = true
  try:
    newLayers = await resolveAllLayers(store.options)
    newConfig = mergeLayers(newLayers, store.options.arrayMerge)

    // Apply config state first — watchers update only after re-merge success
    changes = diffKeys(store.lastConfig, newConfig)
    store.lastConfig = store.options.configMutability === 'mutable' ? deepClone(newConfig) : newConfig
    store._config = newConfig
    store._layers = newLayers

    // Update watchers after config state, with rollback on failure
    try:
      updateWatchers(store, newLayers)
    catch (watcherError):
      // Rollback watcher state, keep new config
      log to onDebug/stderr

    emitChanges(changes, store.listeners)
  catch (error):
    // Keep the last valid state on transient error
    log to onDebug/stderr
  finally:
    store.remergeInProgress = false
    if store.pendingRemerge:
      store.pendingRemerge = false
      remerge(store)
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

- **I/O reads**: 2 minimum reads (`global` + `project`) + 1 per `extends` file + reads of watchable hooks.
- **Memory footprint**: constant and minimal, shared stable Proxy in `frozen` mode.
- **Event latency**: $\le 50\text{ ms}$ after debounce expiration.

### 7.2 Stable Proxy

In `frozen` mode, `store.config` is backed by a stable Proxy (`stable-proxy.ts`) that always reads from `state._config`, even after config swaps during live-reload. This means `store.config` maintains referential stability across re-merges — consumers can hold a reference without it becoming stale. Nested objects are wrapped lazily and cached via `WeakMap`. Set and delete are blocked in frozen mode (throws `TypeError`). In `mutable` mode, `state._config` is a plain mutable object assigned directly.

### 7.3 `globalDir` Resolution

`resolveGlobalDirectory` resolves the global configuration directory with the following priority:

1. **Explicit `globalDir` option** — used as-is, with tilde expansion:
   - `~/path` → resolved to `<homedir>/path`
   - `~` → resolved to `<homedir>`
   - Other values → resolved via `path.resolve`
2. **Windows fallback** — if no explicit `globalDir` and `APPDATA` env var is set on `win32`: `%APPDATA%/<name>`
3. **Default** — `~/.config/<name>`

### 7.4 Known Limitations

1. `fs.watch` cross-platform (macOS `fsevents`, Linux `inotify`, Windows `ReadDirectoryChangesW`): directory-level watching with filename filtering protects against descriptor loss.
2. No symlink following: normalization via `path.resolve` only.
3. The dot (`.`) is a key separator for diff and events only (`store.on("foo.bar")`). The internal structure preserves raw keys without artificial destructuring.
4. Circular `extends` detected with maximum depth `MAX_DEPTH = 10` (`ECYCLE`).
5. `defaults` and `overrides` apply `$env` and clean up `extends`, but do not follow an `extends` chain (files only).
6. `initConfig` initializes only the project configuration, never the global configuration.
7. `extends` and `$env` are absolute reserved keywords.
8. No wildcards (`*`) in events.
9. Stateless hooks only in the current version (no runtime mutators).

---

## 8. Revision History

- **1.0.0** (2026-08-20): Candidate normative specification 1.0.0, integration of the 8 lifecycle hook points, architecture pseudocode, and separation of design into `DESIGN.md`.
- **1.1.0** (2026-08-23): Native path module (`parsePath`, `validatePath`, `getPathValue`, `setPathValue`, `hasRemovedPathValue`) with dot/bracket notation, array index support, and prototype pollution protection (`__proto__`, `constructor`, `prototype`). Atomic write engine (`writeConfigFile`) with per-file promise queue, temp-file + rename strategy, and `EWRITE` error code. `serialize` method added to `FormatPlugin`. Native accessors on `MorselStore`: `get`, `set`, `has`, `unset`, `all`, `dotify` (aliases of `mutateKey`/`deleteKey` + read/flatten helpers). Optimistic in-memory update with listener notification and automatic rollback on write failure. Concurrent re-merge detection: rollback is skipped if `state._config` has changed during `await writeConfigFile` (watcher re-merge took precedence). Array mutator API on `MorselStore`: `push`, `unshift`, `pop`, `shift`, `splice` (sugar on `mutateKey` with full array replacement) + `indexOf`/`lastIndexOf` read helpers. `EVALIDATE` extended to cover type mismatch (non-array target). `StoreTarget` and `DeleteTarget` types.
