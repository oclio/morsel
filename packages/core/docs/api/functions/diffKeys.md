[**@oclio/morsel**](../index.md)

***

> **diffKeys**(`oldObject`, `newObject`): `Map`&lt;`string`, [`KeyChange`](../interfaces/KeyChange.md)&gt;

Defined in: [packages/core/src/merge/diff-keys.ts:217](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/merge/diff-keys.ts#L217)

Compute the diff between two config objects as a Map of dotted keys to changes.

- Scalars: emit the key if the value changed.
- Objects: descend recursively into children.
- Arrays: emit the parent key if the array changed (no per-index diff).
- Type changes (scalar ↔ object): emit the parent as `modified` with the
  full old/new object as `prev`/`next`, plus all child scalars as
  `added`/`removed`.
- Wholly-added/removed objects: emit the parent key as `added`/`removed`
  with the full object, plus all child scalars.

## Parameters

### oldObject

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

The previous config.

### newObject

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

The new config.

## Returns

`Map`&lt;`string`, [`KeyChange`](../interfaces/KeyChange.md)&gt;

A Map of dotted keys to `{ next, prev, category }` changes.
