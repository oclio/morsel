# @oclio/morsel

## 0.5.3

### Patch Changes

- 50d8a3e: Fix `triggerRemerge` JSDoc in `hooks/types.ts` to accurately describe the in-progress and pending flag coalescence mechanism.

## 0.5.2

### Patch Changes

- 402c763: Fix optimistic update cascade re-merge, loadConfig hook duplication, and several spec compliance bugs
  
  - Re-merge the entire layer cascade in mutateKey/deleteKey optimistic updates instead of mutating state._config directly, preventing event flicker and silent state corruption when a key exists in multiple layers
  - Deduplicate the hook sequence in async loadConfig by delegating to buildLayers
  - Use path.extname in NoPluginError to match selectParser matching logic
  - Prefix fire-and-forget remerge with void in startRecovery
  - Skip writeConfigFile write when the mutation is a no-op
  - Return EMPTY from resolvePath when a nested path is removed or nulled, preventing TypeError in held proxies
  - Strip reserved keys (extends, $env) from hook layers to enforce spec §1.4 invariant
  - Check abort signal after hook init in watchConfig
  - Propagate serialize errors in initConfig instead of silent fallback
  - Release watchers when hook init fails in watchConfig

## 0.5.1

### Patch Changes

- 1c81b12: Fix initConfig to use format plugin serialize method instead of hardcoded JSON, preventing extension/content mismatch when a non-JSON plugin is first in the list. Extract shared unsafe-keys module to fix missing `prototype` in deepMerge prototype pollution guard.

## 0.5.0

### Minor Changes

- 0ba6a8e: - **Breaking:** `store.on()` listener signature changed from `(next, prev) => void` to `(event: ChangeEvent) => void`
  - **Breaking:** `MorselHook`/`MorselWatchableHook` renamed to `LayerHook`/`LayerWatchableHook`
  - **Breaking:** `MorselErrorCode` renamed to `ErrorCode`
  - **Breaking:** `configName` removed from `MorselLayer`
  - **Breaking:** `serialize` is now required on `FormatPlugin`
  - Add `${VAR}` and `{{ref.path}}` interpolation to config pipeline
  - Add wildcard pattern support (`foo.*`, `**`) to `store.on()` events
  - Add `once` option to `store.on()` for auto-unsubscribe after first event
  - Add `AbortSignal` support to `watchConfig` via `signal` option
  - Add `triggerRemerge` and `init`/`dispose` lifecycle to hooks
  - Add `after:write` event hooks for post-write side effects
  - Add `.config/` directory support for project config resolution
  - Add prototype pollution protection in `deepMerge` and `deepCloneValue`
  - Drop `Morsel` prefix from all public types and error classes

## 0.4.0

### Minor Changes

- 4aecb70: Add write engine, transactional mutation API, path utilities, and spec audit fixes
  
  - Path parsing (parsePath/validatePath) with dot/bracket notation and prototype pollution protection
  - Path access (getPathValue/setPathValue/hasRemovedPathValue) for nested object/array access
  - dotifyObject to flatten config to 1D dotted record
  - Atomic write engine (writeConfigFile) with per-file promise queue and temp-file + rename strategy
  - EWRITE error code for write/mutation failures
  - JSON plugin serialize method
  - Native store accessors (get/set/has/unset/all/dotify/mutateKey/deleteKey) with optimistic update, listener notification, and automatic rollback on write failure
  - Concurrent re-merge detection: rollback skipped when state._config changed during await
  - Array mutator API (push/unshift/pop/shift/splice) plus indexOf/lastIndexOf read helpers
  - EVALIDATE extended to type mismatch (assertArray)
  - Allow dashes and underscores in config name
  - Spec audit: aligned generics, moved WatcherEntry/WatcherRegistry to public, documented path utilities, writeConfigFile engine, stable proxy, globalDir resolution
  - Fixed logDebug dead code: check onDebug === noop in addition to undefined
  - Added Readonly to MorselValidationError.issues

## 0.3.1

### Patch Changes

- 9b4b086: Fix README image paths to use absolute GitHub raw URLs so logos and demo GIF render correctly on npm.

## 0.3.0

### Minor Changes

- b1f831d: Redesign documentation homepage and READMEs with interactive demo refinements: timeless config examples, fixed panel heights, flash effect on merge, red header on JSON parse error, and updated demo GIF.

## 0.2.0

### Minor Changes

- 70b8135: Added VitePress documentation site with interactive demo, TypeDoc-generated API reference, guide pages, and GitHub Pages deployment workflow.
