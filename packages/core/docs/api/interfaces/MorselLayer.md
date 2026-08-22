[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/store/types.ts:103](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L103)

Immutable snapshot of a single resolved config layer.

## Properties

### config

> `readonly` **config**: `Readonly`&lt;`Record`&lt;`string`, `unknown`&gt;&gt;

Defined in: [packages/core/src/store/types.ts:110](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L110)

***

### exists

> `readonly` **exists**: `boolean`

Defined in: [packages/core/src/store/types.ts:111](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L111)

***

### extendsPaths

> `readonly` **extendsPaths**: readonly `string`[]

Defined in: [packages/core/src/store/types.ts:116](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L116)

Resolved extends paths for this layer (file layers only).
Empty for defaults/overrides/hooks.

***

### hookName?

> `readonly` `optional` **hookName?**: `string`

Defined in: [packages/core/src/store/types.ts:108](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L108)

Present only if source === 'hook'. Name of the hook.

***

### path

> `readonly` **path**: `string` \| `undefined`

Defined in: [packages/core/src/store/types.ts:109](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L109)

***

### source

> `readonly` **source**: `"defaults"` \| `"global"` \| `"project"` \| `"overrides"` \| `"hook"`

Defined in: [packages/core/src/store/types.ts:104](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/store/types.ts#L104)
