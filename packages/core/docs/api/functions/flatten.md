[**@oclio/morsel**](../index.md)

***

> **flatten**(`object`): `Map`&lt;`string`, `unknown`&gt;

Defined in: [packages/core/src/merge/flatten.ts:13](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/merge/flatten.ts#L13)

Flatten a config object into a Map of dotted keys to scalar/array values.
Stops at arrays — they are treated as leaf values.

Example: `{ foo: { bar: 123 } }` → `Map { 'foo.bar' => 123 }`

## Parameters

### object

[`ConfigRecord`](../type-aliases/ConfigRecord.md)

The config object to flatten.

## Returns

`Map`&lt;`string`, `unknown`&gt;

A Map of dotted keys to values.
