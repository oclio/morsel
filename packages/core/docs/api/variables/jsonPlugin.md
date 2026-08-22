[**@oclio/morsel**](../index.md)

***

> `const` **jsonPlugin**: [`MorselFormatPlugin`](../interfaces/MorselFormatPlugin.md)

Defined in: [packages/core/src/plugins/json-plugin.ts:12](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/plugins/json-plugin.ts#L12)

Built-in JSON format plugin.

Parses JSON content and validates that the root is a plain object
(not null, array, or primitive). Throws `SyntaxError` on invalid JSON,
which core wraps into `MorselError` (code `EPARSE`).
