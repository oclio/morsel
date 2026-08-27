---
'@morsel/core': patch
---

Reduce redundant object and collection allocations across the merge, diff, and interpolation pipelines. Each re-merge now performs fewer Map/array clones, lowering GC pressure on hot paths without changing any public API.
