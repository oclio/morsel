[**@oclio/morsel**](../index.md)

***

> **deepMerge**(`base`, `override`, `strategy`): [`ConfigRecord`](../type-aliases/ConfigRecord.md)

Defined in: [packages/core/src/merge/deep-merge.ts:56](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/merge/deep-merge.ts#L56)

Deep merge two config records recursively.

- Objects: deep merge recursively.
- Arrays: `replace` (default) or `concat` per strategy.
- Scalars: override wins.
- `undefined`: ignored (does not overwrite).
- `null`: overwrites (allows reset).

## Parameters

### base

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

The base config (lower priority).

### override

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

The override config (higher priority).

### strategy

[`ArrayMergeStrategy`](../type-aliases/ArrayMergeStrategy.md)

Array merge strategy.

## Returns

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

A new merged config record — inputs are not mutated.
