[**@oclio/morsel**](../index.md)

***

> **defineConfig**&lt;`T`&gt;(`config`): [`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

Defined in: [packages/core/src/utils/define-config.ts:13](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/utils/define-config.ts#L13)

Type helper — infers `T` from `defaults`.

The consumer doesn't need to declare the interface explicitly.
Pass the result to `loadConfig`, `loadConfigSync`, or `watchConfig`.

## Type Parameters

### T

`T` *extends* `Record`&lt;`string`, `unknown`&gt;

## Parameters

### config

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

The config options with typed defaults/overrides.

## Returns

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

The same config options (identity — type inference only).
