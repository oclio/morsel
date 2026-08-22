[**@oclio/morsel**](../index.md)

***

> **initConfig**&lt;`T`&gt;(`options`): `string`

Defined in: [packages/core/src/utils/init-config.ts:22](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/utils/init-config.ts#L22)

Bootstrap a project config file if it doesn't exist.

1. Check if `./<name>.config<ext>` exists (multi-extension via formatPlugins).
2. If yes: return the path, don't write.
3. If no: `mkdirSync(dirname, { recursive: true })`, write `content` (or `fallbackContent`).
4. Return the written path.
5. On failure (permissions, disk full): throw `MorselError` (code `EIO`).

## Type Parameters

### T

`T` *extends* [`ConfigRecord`](../type-aliases/ConfigRecord.md) = [`ConfigRecord`](../type-aliases/ConfigRecord.md)

## Parameters

### options

`Pick`&lt;[`MorselOptions`](../interfaces/MorselOptions.md)&lt;`T`&gt;, `"name"` \| `"cwd"`&gt; & `object`

`{ name, cwd?, content?, fallbackContent? }`.

## Returns

`string`

The existing or written path.

## Throws

MorselError When the write fails.
