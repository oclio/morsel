---
'@oclio/morsel': minor
---

Remove the mutation API — the store is now strictly read-only.

All mutation methods (`set`, `unset`, `push`, `unshift`, `pop`, `shift`,
`splice`, `indexOf`, `lastIndexOf`, `mutateKey`, `deleteKey`, `transaction`)
are removed from `MorselStore`. The filesystem is the single source of truth;
changes are detected via `fs.watch` and re-merged.

The `EWRITE` error code is removed — serialize failures now throw `EIO`.
`setPathValue` and `hasRemovedPathValue` are removed from public exports.

Bundle size drops from ~12 kB to 7.8 kB (35% reduction).
