[**@oclio/morsel**](../index.md)

***

> **loadConfig**&lt;`T`&gt;(`options`): `Promise`&lt;[`ConfigResult`](../interfaces/ConfigResult.md)&lt;`T`&gt;&gt;

Defined in: [packages/core/src/store/load-config.ts:76](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/load-config.ts#L76)

Load and merge config asynchronously.

Same as [loadConfigSync](loadConfigSync.md) but using async fs operations.

## Type Parameters

### T

`T` *extends* [`ConfigRecord`](../type-aliases/ConfigRecord.md) = [`ConfigRecord`](../type-aliases/ConfigRecord.md)

## Parameters

### options

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

Configuration options.

## Returns

`Promise`&lt;[`ConfigResult`](../interfaces/ConfigResult.md)&lt;`T`&gt;&gt;

`{ config, layers }` — the merged config and layer trace.
