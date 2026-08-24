---
'@oclio/morsel': minor
---

- **Breaking:** `store.on()` listener signature changed from `(next, prev) => void` to `(event: ChangeEvent) => void`
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
