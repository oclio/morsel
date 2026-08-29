---
'@oclio/morsel': minor
---

Split `watchConfig` into `createStore` (static, one-shot) and `createReactiveStore` (reactive, with watchers and events). The `watch` and `proxy` flags on options are removed — use the appropriate constructor instead. `MorselStore` no longer exposes `on`/`off`/`triggerRemerge`; use `MorselReactiveStore` for those methods. Removed orphan `indexOf`/`lastIndexOf` from the store API.
