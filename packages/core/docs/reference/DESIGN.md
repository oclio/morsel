# Architecture & Design Rationale — morsel

> Design and architecture document for `@oclio/morsel`.
> Explains the _why_ behind technical choices, design philosophy, glossary, and execution flows.
>
> For normative API contracts and exhaustive specifications, see [`SPEC.md`](./SPEC.md).

---

## 1. Context & Goals

> **You come for the lean, you stay for the watching.**

### 1.1 Problem

Node.js configuration loaders suffer from recurring flaws that compound:

- **Transitive dependencies** that bloat the bundle and widen the attack surface.
- **Hardcoded formats** that prevent extension without overloading the package with third-party parsers.
- **No hierarchical merge** (discovery only) or no discovery (merge only).
- **No native live-reload** or fragile `fs.watch` integration.
- **Broken ESM cache** that prevents hot reloading without cache-busting hacks.
- **Silent file corruption** or wiped configuration without `throw` on parse errors.
- **Mutable-by-default API** that introduces accidental mutations and subtle bugs.
- **Abandoned maintenance** with unpatched vulnerabilities.

morsel starts from the premise that a configuration loader must be **lean, robust, and built for pluggability in its core**:

- **Lean**: zero runtime dependencies, no hardcoded formats — the core is a pipeline, not a toolbox.
- **Robust**: explicit throw on error, never silent, watch resilience with last valid state retention.
- **Pluggable**: parsing, validation, and pipeline extensibility are injectable contracts, not `if (format === 'yaml')` branches in the core.

---

### 1.2 Goals

#### Pluggable pipeline, not monolith

- `FormatPlugin` — parsing is a contract, not a switch. `jsonPlugin` is injected by default, YAML/TOML/JSON5 are opt-in plugins. The core contains no `JSON.parse` outside of `jsonPlugin`.
- `ValidationPlugin` — validation is a post-merge contract. Zod, Valibot, Yup — the user brings their schema, the core wraps the error in `ValidationError`. No validation dependencies in the core.
- `FormatPlugin.serialize` — pure serialization contract. Format plugins define how data is represented as a string for writes, while core orchestrates atomic I/O and target resolution.

#### Lean by construction

- Zero runtime dependencies — `node:fs`, `node:path`, `node:os`, `node:util` only. No `js-yaml`, no `ajv`, no `typescript` pulled into the bundle. Minimal attack surface.
- Formats as opt-in plugins — adding YAML does not add 400 KB to the core, but an external plugin. The core bundle stays < 8 KB.
- ESM + CJS first-class — both formats are natively supported.

#### Robust by default

- Throw, never silent — typed `MorselError` (`EIO`, `EPARSE`, `ENOPLUGIN`, `EVALIDATE`, `ECYCLE`, `EHOOK`, `EWRITE`) with path + cause.
- Watch resilience — `createReactiveStore` throws at boot if the first load fails (no valid fallback state). On re-merge, keeps the last valid state, logs to `stderr`, routes to `onDebug`.
- `frozen` by default — the returned configuration is immutable unless `configMutability: 'mutable'` is explicit.
- Watcher ref-counting — a single `fs.watch` per directory, shared across stores, released when the last store calls `stop()`.

#### Cascade + discovery integrated

- 4 stacked layers: `defaults` (code) → `global` (`~/.config/<name>/<name>.config.*`) → `project` (`./<name>.config.*`) → `overrides` (code). Deep merge by increasing priority.
- Multi-extension discovery — `resolveProjectPath` tests extensions of `formatPlugins` in order.
- Local `extends` (string and string[]) — inheritance between configurations, resolved per layer before inter-layer merge.
- `$env` overrides — environment specialization, applied per file before extends merge.

#### Integrated live-reload

- `createReactiveStore` — watch + key-level events (dotted notation, recursive diff).
- 300 ms debounce by default, configurable per store. Concurrent re-merge handled via `pendingRemerge` queue.
- Directory-level watching + filename filtering — survives atomic deletion/recreation by editors.

#### Ergonomic API

- Distinct sync + async — `loadConfigSync` (sync), `loadConfig` (async), `createStore` (async, static), `createReactiveStore` (async + live-reload). The chosen function determines the behavior.
- Generic typing `loadConfig<T>` / `createReactiveStore<T>`.
- `initConfig` — idempotent project configuration bootstrap with atomic write.
- `resolvePaths` — deterministic exposure of theoretical paths without I/O.

#### Provenance tracking

- `store.getProvenance(path)` — returns the final value, its source layer, file path, and the chain of overridden layers that defined but lost the key. Traverses `store.layers` in reverse cascade order using `getPathValue` on each layer's `config`.
- Answers the #1 config debugging question: "why does my app have this value?" in a single call — no manual layer traversal.
- No new infrastructure — built on existing `MorselLayer` trace and `getPathValue`. Minimal bundle impact.

#### Static vs reactive stores

- `createStore` returns a static `MorselStore` — no watchers, no events, no proxy, no re-merge. The `config` getter returns `state._config` directly. `stop()` is a noop. Use for CI, scripts, CLI one-shot commands.
- `createReactiveStore` returns a `MorselReactiveStore` that extends `MorselStore` with `on`, `off`, `triggerRemerge`, watchers, and re-merge. Sets up `fs.watch` and a stable proxy on `config`.
- Splitting the two constructors (instead of `watch`/`proxy` flags) makes the API explicit — the type system enforces that `on`/`off`/`triggerRemerge` are only available on reactive stores.

---

### 1.3 Extensibility via Lifecycle (`LayerHook`)

The core provides three pluggable contracts:

1. **`FormatPlugin`** — parses a file into a `Record` (bytes → structure).
2. **`ValidationPlugin`** — validates and transforms the merged configuration.
3. **`LayerHook`** — inserts into the pipeline lifecycle, produces a dynamic layer. Optional `init`/`dispose` methods allow stateful hooks to manage external connections.

A layer hook attaches to a specific lifecycle point and produces a `Record<string, unknown>` that inserts as a layer in the cascade, just like `defaults` or `overrides`.

#### Stateful hooks (`init`/`dispose`)

Layer hooks may optionally define `init(ctx)` and `dispose()` methods for stateful use cases (remote config polling, WebSocket subscriptions, etcd watch):

- `init` is called once after the store is created in `createReactiveStore` — use it to open connections, start pollers, etc. If `init` throws, a `MorselError` (`EHOOK`) is thrown and the store is not returned.
- `dispose` is called once when the store is stopped via `stop()` — use it to close connections, clear timers, etc. Errors in `dispose` are caught and logged via `onDebug` — they do not block `stop()`.
- Neither `init` nor `dispose` is called in `loadConfig`/`loadConfigSync` (one-shot, no lifecycle).

#### `triggerRemerge`

The `HookContext` provides `triggerRemerge()` — a function that requests a re-merge of the configuration. This enables hooks to react to external changes (remote config updated, etcd key changed) and trigger a fresh merge cycle:

- In `createReactiveStore`, calling `triggerRemerge()` schedules a re-merge via the store's internal `remerge` function (coalesced via re-merge in-progress and pending flags: if a re-merge is already running, subsequent calls set a pending flag and only one additional re-merge runs after the current one completes).
- In `loadConfig`/`loadConfigSync`, `triggerRemerge` is a noop — there is no store lifecycle.
- Safe to call multiple times — coalesced via the re-merge in-progress and pending flags.

#### 8 layer lifecycle points (before/after for each layer)

```text
before:defaults → defaults → after:defaults
→ before:global → global → after:global
→ before:project → project → after:project
→ before:overrides → overrides → after:overrides
→ merge → validation
```

- `before:X` hooks produce a layer that stacks **before** layer `X` (lower priority).
- `after:X` hooks produce a layer that stacks **after** layer `X` (higher priority).
- Hooks are executed in `hooks[]` array order for the same lifecycle point.
- **Stateless `load`, stateful `init`/`dispose`** — the core calls `load` on each merge (no state between merges). Optional `init`/`dispose` methods allow stateful hooks to manage external connections across the store lifecycle.

---

### 1.4 Non-Goals

- **No remote extends (`gh:`, `https:`)** — loading arbitrary code or configuration from the network widens the attack surface and introduces a fragile external dependency. Local only.
- **No directory traversal** — upward search to the disk root is unpredictable depending on the execution directory. morsel strictly reads `cwd` + `globalDir`. Cross-project sharing is solved explicitly via `extends`.

---

## 2. Design Principles

### 2.1 Cascade by increasing priority

4 stacked layers from lowest to highest priority:
`defaults` (code) → `global` (`~/.config/<name>/<name>.config.*`) → `project` (`./<name>.config.*`) → `overrides` (code). Each layer overrides the previous layer's keys via deep merge.

### 2.2 Per-layer resolution before inter-layer merge

Each layer (`global`, `project`) resolves its own `extends` and `$env` independently:

1. Each file in the `extends` chain applies its `$env` according to `envName` **independently, before extends merge**.
2. Files are then stacked via `extends` (deep merge parent ➔ child).
3. This guarantees that a `$env` block in a parent file never overrides explicit values from a child file.

### 2.3 Recursive diff on scalars, parent for objects/arrays

- A modified/added/removed scalar → emits the deepest dotted key.
- A modified object → recursive descent toward child scalars.
- An entire object replaced (type change, e.g. object → string) or added/removed → emits the parent.
- A modified array → emits the parent only (no per-index diff). `push` additionally emits on `path.<newIndex>` for the newly added element.
- Wildcard patterns (`foo.*`, `**`, `foo.**`) supported in `store.on()` for ergonomic event subscription. Matching is $O(N)$ per key — see SPEC §4.5 for semantics.

### 2.4 Directory-level watching + filename filtering

`fs.watch` watches the directory containing the file, not the file itself:

- Survives atomic deletion/recreation during editor saves.
- Mutualizes watchers per directory via ref-counting.
- Automatically includes directories of all files in the `extends` chain and `watchPaths` declared by hooks.
- **Watcher updates after successful re-merge only**: on re-merge error (`EPARSE`, etc.), current watchers remain intact to keep listening for fixes.

### 2.5 Per-store debounce

Debounce (300 ms by default) is managed at the store level, not the watcher level:

- Two stores watching the same directory can have distinct debounce durations without interfering.
- If a re-merge is in progress when a new filesystem event occurs, the `pendingRemerge = true` state automatically schedules a re-merge in the `finally` block.

---

## 3. Typing & Type Safety

- **No ghost guards**: if the type says `string`, no `if (x === undefined)` is introduced. Typing exactly reflects runtime invariants.
- **Discriminated unions**: `loadFile` and `resolveLayer` return discriminated unions (`exists: true` with populated config, or `exists: false` with empty config `{}`) for TypeScript narrowing without assertions.
- **Strictly typed internal pipeline**: `unknown` exists only at public boundaries (`MorselOptions.defaults`, listener callbacks). Internally, everything is precisely typed.
- **`as` assertions limited to boundaries**: allowed only for `JSON.parse` and conversion of the public generic `T` to `Record<string, unknown>`.

---

## 4. Nomenclature & Glossary

### Public Types & Interfaces

- `MorselOptions` — common configuration options (`name`, `cwd`, `defaults`, `overrides`, `globalDir`, etc.).
- `StoreOptions` — same as `MorselOptions`. Used by `createStore`.
- `ReactiveStoreOptions` — extends `MorselOptions` with `watchDebounce` and `signal`. Used by `createReactiveStore`.
- `MorselStore<T>` — static store instance (`config`, `layers`, `get`, `has`, `all`, `dotify`, `getProvenance`, `stop`).
- `MorselReactiveStore<T>` — extends `MorselStore` with `on`, `off`, `triggerRemerge`.
- `MorselLayer` — trace of a resolved layer (`source`, `path`, `config`, `exists`, `extendsPaths`, `hookName`).
- `MorselError` — base error class with `path`, `code`, and `cause`.
- `ErrorCode` — union of error codes (`'EIO' | 'EPARSE' | 'ENOPLUGIN' | 'EVALIDATE' | 'ECYCLE' | 'EHOOK'`).
- `NoPluginError` — thrown when no extension matches a plugin (`ENOPLUGIN`).
- `ValidationError` — thrown on schema validation failure (`EVALIDATE`).
- `FormatPlugin` — format plugin contract (raw parsing → object).
- `ValidationPlugin` — post-merge validation/transformation plugin contract.
- `LayerHook` — lifecycle hook contract.
- `LayerWatchableHook` — hook declaring watch paths (`watchPaths`).
- `Hook` — union of all hook types (`LayerHook | LayerWatchableHook`).
- `HookLifecycle` — union of the 8 lifecycle points.
- `HookContext` — execution context provided to the hook (`cwd`, `envName`, `triggerRemerge`).
- `ConfigResult<T>` — result returned by `loadConfig` / `loadConfigSync`.
- `ResolvedPaths` — theoretical paths resolved without I/O (`global`, `project`).
- `ResolvePathsOptions` — options for `resolvePaths`.
- `LayerSource` — `'defaults' | 'global' | 'project' | 'overrides' | 'hook'`.
- `ArrayMergeStrategy` — `'replace' | 'concat'`.
- `ConfigMutability` — `'frozen' | 'mutable'`.
- `ChangeCategory` — `'added' | 'modified' | 'removed'`.
- `KeyChange` — structure of a change `{ next, prev, category }`.
- `ChangeEvent` — event object `{ keyPath, type, next, prev }` passed to listeners.
- `ListenerOptions` — options for `store.on()` (`once`).
- `Listener` — event callback `(event: ChangeEvent) => void`.
- `DebugCallback` — custom debug sink.
- `ConfigRecord` — generic configuration object record (`Record<string, unknown>`).
- `Provenance` — provenance of a key (`value`, `source`, `file`, `hookName`, `overridden`).
- `ProvenanceOverride` — entry in the `overridden` chain (`value`, `source`, `file`, `hookName`).

### Public Functions

- `loadConfig` — asynchronous one-shot loading.
- `loadConfigSync` — synchronous one-shot loading.
- `createStore` — asynchronous static loading (no watchers, no events).
- `createReactiveStore` — asynchronous loading with watch and live-reload.
- `resolvePaths` — path computation without disk reads.
- `initConfig` — atomic and idempotent configuration file initialization.
- `deepMerge` — deterministic deep merge with array strategy handling.
- `diffKeys` — recursive delta computation between two configurations.
- `interpolate` — `${VAR}` env and `{{ref.path}}` cross-reference interpolation on merged config.
- `defineConfig` — typing and options validation helper.
- `mergeConfig` — composition of two `MorselOptions` objects.
- `parsePath` — dot/bracket path parsing into segments.
- `validatePath` — prototype pollution guard for path segments.
- `getPathValue` — read a value by dot/bracket path.
- `setPathValue` — set a value by dot/bracket path.
- `hasRemovedPathValue` — check if a path would be removed by delete.
- `jsonPlugin` — built-in JSON format plugin.
- `getRegistry` — test/internal helper to inspect the global watcher registry.
- `clearRegistry` — test/internal helper to clear the global watcher registry.

### Internal Types & Functions

> For the detailed normative definition of internal types, see [`SPEC.md` section 4.2](./SPEC.md#42-normative-internal-interfaces).

- `LoadFileResult` — discriminated union (`exists: true` + populated config, or `exists: false` + `Record<string, never>`).
- `ResolvedLayer` — intermediate resolved layer (`source`, `path`, `exists`, `config`, `extendsPaths`, `hookName`).
- `ResolvedOptions` — complete validated options with default values applied.
- `StoreState` — internal mutable shared state of a reactive store.
- `WatcherEntry` — `WatcherRegistry` entry (`watcher`, `refCount`, `stores`, `retryTimer`).
- `WatcherRegistry` — global registry mapping directory paths to `WatcherEntry` (`Map<string, WatcherEntry>`).
- `buildLayers` — async orchestration of the 4 core layers and hooks resolution. The sync path is handled inline by `loadConfigSync` via `runHooksSync` + `resolveLayerSync`.
- `resolveExtends` / `resolveExtendsSync` — recursive resolution of the local inheritance chain.
- `handleWatchEvent` — filtering and dispatching of `fs.watch` events to concerned stores.
- `emitChanges` — delta computation and Two-Phase Ordering dispatch to listeners. Supports wildcard patterns (`foo.*`, `**`) via separate wildcard listener map.
- `dotifyObject` — flatten a nested object into a 1D record with dotted paths. Internal equivalent of `MorselStore.dotify()`.

---

## 5. Flow Diagram

```text
loadConfigSync(opts) / loadConfig(opts)
│
├─ resolveOptions(opts) ─── validation (assertName) + defaults application
│
├─ [hooks before:defaults] ─── load() → Record, $env + extends cleanup, inserted as layer
├─ resolveLayer('defaults', undefined, opts.defaults)  ─── raw object, no extends/$env
├─ [hooks after:defaults]  ─── load() → Record, $env + extends cleanup, inserted as layer
│
├─ [hooks before:global]   ─── load() → Record, $env + extends cleanup, inserted as layer
├─ resolveLayer('global', globalPath, ...)            ─── loadFile + extends + $env + cleanup
├─ [hooks after:global]    ─── load() → Record, $env + extends cleanup, inserted as layer
│
├─ [hooks before:project]  ─── load() → Record, $env + extends cleanup, inserted as layer
├─ resolveLayer('project', projectPath, ...)          ─── loadFile + extends + $env + cleanup
├─ [hooks after:project]   ─── load() → Record, $env + extends cleanup, inserted as layer
│
├─ [hooks before:overrides] ─── load() → Record, $env + extends cleanup, inserted as layer
├─ resolveLayer('overrides', undefined, opts.overrides) ─── raw object, no extends/$env
├─ [hooks after:overrides]  ─── load() → Record, $env + extends cleanup, inserted as layer
│
└─ mergeLayers(allLayers, arrayMerge) ─── deepMerge in order
    │
    └─ interpolate(merged) ─── ${VAR} from env, {{ref.path}} cross-refs, ECYCLE on cycles
    │
    └─ applyValidation(config, validationPlugins) ─── if provided
    │
    └─ applyMutability(config, configMutability)
    │
    └─ ConfigResult { config, layers }

createReactiveStore(opts)
│
├─ [same as loadConfig] ─── initial merge (resolveOptions + buildLayers + processConfig)
│
├─ collectWatchedFiles(state, layers) ─── indexes extends paths + hook watchPaths
├─ setupWatchers(state, layers)        ─── ref-counting via WatcherRegistry
│   ├─ createWatcher(globalDir)       ─── ref-counting via WatcherRegistry
│   ├─ createWatcher(projectDir)      ─── ref-counting via WatcherRegistry
│   ├─ createWatcher(extendsDirs[])   ─── one watcher per extends directory
│   └─ createWatcher(hookWatchDirs[]) ─── one watcher per hook watchPaths directory
│
└─ MorselStore<T> { config, layers, on(), get(), has(), all(), dotify(), getProvenance(), stop() }
    │
    ├─ store.get(path, default)    ─── read by dot/bracket path
    ├─ store.has(path)             ─── key existence check
    ├─ store.all()                 ─── full clone snapshot
    ├─ store.dotify()              ─── 1D dotted record
    ├─ store.getProvenance(path)  ─── reverse traverse of layers, first hit = winner, rest = overridden
    │
    └─ fs.watch fire (directory) ─── filtering by filename
        │
        └─ debounce(300ms) ─── if re-merge in progress: deferred via pendingRemerge
            │
            └─ full re-merge (same as loadConfig via buildLayers)
                │   └─ buildLayers → resolveLayer → resolveExtends re-collects paths
                │       ⚠ update watchers (createWatcher/releaseWatcher) AFTER
                │         successful re-merge only. On failure → keep current
                │         watchers (implicit rollback, config and watcher graph
                │         remain at last valid state)
                │
                └─ emitChanges(oldConfig, newConfig)
                    │
                    └─ for each key (two-phase ordering):
                        └─ store.on(key, cb) → cb(next, prev)
```
