---
'@oclio/morsel': patch
---

Fix prototype pollution in `deepMerge` and `interpolate`: unsafe keys (`__proto__`, `constructor`, `prototype`) are now filtered during deep cloning. Consolidate three duplicate `deepClone` implementations into a single shared utility in `@/utils/deep-clone`.
