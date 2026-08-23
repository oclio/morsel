---
'@oclio/morsel': minor
---

Add write engine, transactional mutation API, path utilities, and spec audit fixes

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
