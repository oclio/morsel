[**@oclio/morsel**](../index.md)

***

> **watchConfig**&lt;`T`&gt;(`options`): `Promise`&lt;[`MorselStore`](../interfaces/MorselStore.md)&lt;`T`&gt;&gt;

Defined in: [packages/core/src/store/watch-config.ts:26](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/watch-config.ts#L26)

Load config, watch files, and emit key-level events on change.

At boot: loads and merges all layers. Throws `MorselError` if the initial
load fails (no valid state to fall back on).

On `fs.watch` fire: re-merges, emits changes. Errors are caught internally
and routed to `onDebug`/stderr — the last valid config is preserved.

## Type Parameters

### T

`T` *extends* [`ConfigRecord`](../type-aliases/ConfigRecord.md) = [`ConfigRecord`](../type-aliases/ConfigRecord.md)

## Parameters

### options

[`WatchOptions`](../interfaces/WatchOptions.md)&lt;`T`&gt;

Configuration options.

## Returns

`Promise`&lt;[`MorselStore`](../interfaces/MorselStore.md)&lt;`T`&gt;&gt;

A reactive store with `config`, `layers`, `on()`, `stop()`.
