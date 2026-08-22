[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/hooks/types.ts:23](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L23)

Context passed to a hook's `load` method.

Stateless — a fresh context is created for each merge.
The hook must not store references to the context between merges.

## Properties

### cwd

> `readonly` **cwd**: `string`

Defined in: [packages/core/src/hooks/types.ts:27](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L27)

cwd resolved from options.

***

### envName

> `readonly` **envName**: `string` \| `undefined`

Defined in: [packages/core/src/hooks/types.ts:31](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L31)

envName resolved from options (process.env.NODE_ENV or explicit).
