[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/hooks/types.ts:43](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L43)

Hook contract — inserts into the pipeline at a lifecycle point and produces a layer.

The hook is stateless: the core calls `load` at each merge, no state between merges.
Sync (Record) or async (Promise\<Record\>). Async hooks throw TypeError in loadConfigSync.
If `load` throws → MorselError (code EHOOK).

## Extended by

- [`MorselWatchableHook`](MorselWatchableHook.md)

## Properties

### lifecycle

> `readonly` **lifecycle**: [`HookLifecycle`](../type-aliases/HookLifecycle.md)

Defined in: [packages/core/src/hooks/types.ts:51](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L51)

Insertion point in the pipeline.

***

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/hooks/types.ts:47](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L47)

Unique hook name, ex: "env", "package-json". Becomes hookName in MorselLayer.

## Methods

### load()

> **load**(`context`): `Record`&lt;`string`, `unknown`&gt; \| `Promise`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;

Defined in: [packages/core/src/hooks/types.ts:57](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L57)

Produce a Record inserted as a layer in the cascade.
Sync (Record) or async (Promise\<Record\>).
If throw → MorselError (code EHOOK).

#### Parameters

##### context

[`HookContext`](HookContext.md)

#### Returns

`Record`&lt;`string`, `unknown`&gt; \| `Promise`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;
