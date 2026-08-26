---
'@oclio/morsel': minor
---

Add `store.getProvenance(path)` — traces the final value of a config key, its source layer (project/global/defaults/hook), the file path, and the chain of overridden layers that defined but lost the key. New public types: `Provenance`, `ProvenanceOverride`.
