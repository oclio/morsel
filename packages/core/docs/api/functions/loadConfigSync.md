[**@oclio/morsel**](../index.md)

***

> **loadConfigSync**&lt;`T`&gt;(`options`): [`ConfigResult`](../interfaces/ConfigResult.md)&lt;`T`&gt;

Defined in: [packages/core/src/store/load-config.ts:27](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/load-config.ts#L27)

Load and merge config synchronously.

Reads defaults → global → project → overrides, deep-merges them,
and returns the result. Throws `MorselError` on fs or parse errors.

## Type Parameters

### T

`T` *extends* [`ConfigRecord`](../type-aliases/ConfigRecord.md) = [`ConfigRecord`](../type-aliases/ConfigRecord.md)

## Parameters

### options

[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;

Configuration options.

## Returns

[`ConfigResult`](../interfaces/ConfigResult.md)&lt;`T`&gt;

`{ config, layers }` — the merged config and layer trace.
