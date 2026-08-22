[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/store/types.ts:132](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L132)

Public store returned by `watchConfig` — exposes config, layers, listeners, and stop.

## Type Parameters

### T

`T` *extends* `Record`&lt;`string`, `unknown`&gt; = `Record`&lt;`string`, `unknown`&gt;

## Properties

### config

> `readonly` **config**: `T`

Defined in: [packages/core/src/store/types.ts:142](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L142)

Merged config, always up-to-date via getter.

In frozen mode: stable delegating proxy — same reference for life,
forwards all gets to the internal snapshot.
Frozen after stop() at the last state.

***

### layers

> `readonly` **layers**: [`MorselLayer`](MorselLayer.md)[]

Defined in: [packages/core/src/store/types.ts:146](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L146)

Trace of resolved layers. Live during watch, frozen after stop(). Via getter.

## Methods

### on()

> **on**(`key`, `listener`): () => `void`

Defined in: [packages/core/src/store/types.ts:150](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L150)

Listen to a flat key (dotted notation). Returns unsubscribe.

#### Parameters

##### key

`string`

##### listener

[`Listener`](../type-aliases/Listener.md)

#### Returns

() => `void`

***

### stop()

> **stop**(): `Promise`&lt;`void`&gt;

Defined in: [packages/core/src/store/types.ts:154](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L154)

Stop watching, clean up listeners. Async.

#### Returns

`Promise`&lt;`void`&gt;
