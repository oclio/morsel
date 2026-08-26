---
'@oclio/morsel': patch
---

Fix three spec compliance bugs found via skipped e2e tests:

- **unshift** now returns the new array length instead of 0 (spec §4.5)
- **indexOf** and **lastIndexOf** throw `MorselError(EVALIDATE)` on non-array keys instead of returning -1 (spec §4.5)
- **getPathValue**, **setPathValue**, and **hasRemovedPathValue** now validate array paths against prototype pollution (`__proto__`, `constructor`, `prototype`) — previously only string paths were validated
