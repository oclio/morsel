[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/plugins/types.ts:9](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L9)

Format plugin contract — parses file content into a config record.

Each plugin handles one or more file extensions (ex: `.json`, `.yaml`).
The core handles `extends` and `$env` — the plugin only parses raw content.

If parsing fails, the plugin throws; core wraps it into `MorselError` (code `EPARSE`).

## Properties

### extensions

> `readonly` **extensions**: readonly `string`[]

Defined in: [packages/core/src/plugins/types.ts:17](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L17)

Handled extensions, ex: [".json"]. Matched against path.extname(filePath).

***

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/plugins/types.ts:13](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L13)

Unique plugin name, ex: "json", "yaml".

## Methods

### parse()

> **parse**(`content`, `filePath`): `Record`&lt;`string`, `unknown`&gt;

Defined in: [packages/core/src/plugins/types.ts:23](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L23)

Parse file content into a config record.
Throw on invalid content — core wraps into MorselError (code EPARSE).
Does not handle extends or $env — core manages those.

#### Parameters

##### content

`string`

##### filePath

`string`

#### Returns

`Record`&lt;`string`, `unknown`&gt;
