[**@oclio/morsel**](../index.md)

***

> **DebugCallback** = (`message`, `context?`) => `void`

Defined in: [packages/core/src/load/resolve-env.ts:10](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/load/resolve-env.ts#L10)

Debug callback invoked when a non-fatal issue is detected (e.g. invalid `$env`).
Receives a human-readable message and optional context.

## Parameters

### message

`string`

### context?

`Record`&lt;`string`, `unknown`&gt;

## Returns

`void`
