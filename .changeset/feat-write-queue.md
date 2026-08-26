---
'@oclio/morsel': minor
---

Add write queue for mutation serialization — concurrent calls to `set`, `unset`, `push`, and other mutation APIs are now serialized via a per-store Promise chain, eliminating race conditions where overlapping writes could silently lose data. Errors in one mutation do not block subsequent mutations. `stop()` now drains the queue before closing watchers, ensuring in-flight mutations complete on shutdown.
