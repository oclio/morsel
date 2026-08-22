[**@oclio/morsel**](../index.md)

***

Defined in: [packages/core/src/plugins/types.ts:36](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L36)

Validation plugin contract — validates and optionally transforms the merged config.

Applied post-merge, in order. Each plugin can validate and transform the config
(coercion, defaults, strip). If a plugin throws, core wraps it into
`MorselValidationError`.

The plugin must return a new reference — do not mutate the argument.
The input is not guaranteed mutable (a previous plugin may return a frozen object).

## Properties

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/plugins/types.ts:40](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L40)

Unique plugin name, ex: "zod", "valibot".

## Methods

### validate()

> **validate**(`config`): `Record`&lt;`string`, `unknown`&gt;

Defined in: [packages/core/src/plugins/types.ts:47](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/types.ts#L47)

Validate and optionally transform the final config (post-merge).
Return the config (potentially modified) if valid.
Throw if invalid — core wraps into MorselValidationError with the issues.
Strict/flex (accept extra keys, strip, coerce) is the plugin's responsibility.

#### Parameters

##### config

`Record`&lt;`string`, `unknown`&gt;

#### Returns

`Record`&lt;`string`, `unknown`&gt;
