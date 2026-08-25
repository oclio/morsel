---
'@oclio/morsel': patch
---

Fix optimistic update cascade re-merge, loadConfig hook duplication, and several spec compliance bugs

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
