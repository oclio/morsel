[**@oclio/morsel**](../index.md)

***

> **mergeConfig**&lt;`T`&gt;(`base`, `overrides`): [`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

Defined in: [packages/core/src/utils/define-config.ts:29](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/utils/define-config.ts#L29)

Compose two config option sets via deep merge.

`defaults` and `overrides` are deep-merged. Other options (name, cwd, etc.)
are taken from `base`, overridden by `overrides` if present. `T` is preserved.

## Type Parameters

### T

`T` *extends* `Record`&lt;`string`, `unknown`&gt; = [`ConfigRecord`](../type-aliases/ConfigRecord.md)

## Parameters

### base

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

The base config options.

### overrides

`Partial`&lt;[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;&gt;

The partial overrides to merge in.

## Returns

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

The composed config options.
