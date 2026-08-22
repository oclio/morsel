[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/hooks/types.ts:69](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L69)

Watchable hook — extends MorselHook with static watchPaths.

The core watches these paths the same way as extends files:
collectWatchedFiles and collectDirectories include them.
watchPaths is static (the hook is stateless).

## Extends

- [`MorselHook`](MorselHook.md)

## Properties

### lifecycle

> `readonly` **lifecycle**: [`HookLifecycle`](../type-aliases/HookLifecycle.md)

Defined in: [packages/core/src/hooks/types.ts:51](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L51)

Insertion point in the pipeline.

#### Inherited from

[`MorselHook`](MorselHook.md).[`lifecycle`](MorselHook.md#lifecycle)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/hooks/types.ts:47](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L47)

Unique hook name, ex: "env", "package-json". Becomes hookName in MorselLayer.

#### Inherited from

[`MorselHook`](MorselHook.md).[`name`](MorselHook.md#name)

***

### watchPaths

> `readonly` **watchPaths**: readonly `string`[]

Defined in: [packages/core/src/hooks/types.ts:73](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L73)

Paths watched by the core. The core creates a watcher per directory.

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

#### Inherited from

[`MorselHook`](MorselHook.md).[`load`](MorselHook.md#load)
