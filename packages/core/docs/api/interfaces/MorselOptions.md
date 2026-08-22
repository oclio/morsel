[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/store/types.ts:23](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L23)

User-facing options for `loadConfig` and `watchConfig`.

## Extended by

- [`WatchOptions`](WatchOptions.md)

## Type Parameters

### T

`T` *extends* `Record`&lt;`string`, `unknown`&gt; = `Record`&lt;`string`, `unknown`&gt;

## Properties

### arrayMerge?

> `readonly` `optional` **arrayMerge?**: [`ArrayMergeStrategy`](../type-aliases/ArrayMergeStrategy.md)

Defined in: [packages/core/src/store/types.ts:49](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L49)

Default: 'replace'. 'concat' to concatenate arrays.

***

### configMutability?

> `readonly` `optional` **configMutability?**: [`ConfigMutability`](../type-aliases/ConfigMutability.md)

Defined in: [packages/core/src/store/types.ts:57](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L57)

Default: 'frozen'. 'mutable' = plain mutable object.

***

### cwd?

> `readonly` `optional` **cwd?**: `string`

Defined in: [packages/core/src/store/types.ts:33](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L33)

Default: process.cwd()

***

### defaults?

> `readonly` `optional` **defaults?**: `T`

Defined in: [packages/core/src/store/types.ts:37](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L37)

Layer 1 — lowest priority. Raw object, no extends or $env.

***

### envName?

> `readonly` `optional` **envName?**: `string`

Defined in: [packages/core/src/store/types.ts:53](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L53)

Default: process.env.NODE_ENV. Pinned if explicit string, live if implicit.

***

### formatPlugins?

> `readonly` `optional` **formatPlugins?**: [`MorselFormatPlugin`](MorselFormatPlugin.md)[]

Defined in: [packages/core/src/store/types.ts:71](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L71)

Format plugins. Default: [jsonPlugin].
Order = match priority by extension.
First plugin whose extensions include path.extname(filePath) wins.

***

### globalDir?

> `readonly` `optional` **globalDir?**: `string`

Defined in: [packages/core/src/store/types.ts:45](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L45)

Default: ~/.config/morsel

***

### hooks?

> `readonly` `optional` **hooks?**: [`MorselHook`](MorselHook.md)[]

Defined in: [packages/core/src/store/types.ts:85](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L85)

Hooks inserted into the pipeline at their lifecycle point.
Each hook produces a Record that becomes a layer.
Async hooks (Promise) → TypeError in loadConfigSync.
MorselWatchableHook → watchPaths watched by the core.

***

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/store/types.ts:29](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L29)

Base name, ex: "myapp". Required, alphanumeric.

***

### onDebug?

> `readonly` `optional` **onDebug?**: [`DebugCallback`](../type-aliases/DebugCallback.md)

Defined in: [packages/core/src/store/types.ts:65](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L65)

Custom debug logger. Use an empty function for total silence.

***

### overrides?

> `readonly` `optional` **overrides?**: `T`

Defined in: [packages/core/src/store/types.ts:41](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L41)

Layer 4 — highest priority. Raw object, no extends or $env.

***

### validationPlugins?

> `readonly` `optional` **validationPlugins?**: [`MorselValidationPlugin`](MorselValidationPlugin.md)[]

Defined in: [packages/core/src/store/types.ts:78](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L78)

Validation plugins. Default: [].
Applied on the final config (post-merge), in order.
Each plugin can validate and transform the config (coercion, defaults, strip).
If a plugin throws → MorselValidationError. Boot: throw. Re-merge: catch + keep previous.

***

### verbose?

> `readonly` `optional` **verbose?**: `boolean`

Defined in: [packages/core/src/store/types.ts:61](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L61)

Default: false. Log everything on stderr/onDebug.
