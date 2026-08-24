---
'@oclio/morsel': patch
---

Fix initConfig to use format plugin serialize method instead of hardcoded JSON, preventing extension/content mismatch when a non-JSON plugin is first in the list. Extract shared unsafe-keys module to fix missing `prototype` in deepMerge prototype pollution guard.
