[**@oclio/morsel**](../index.md)

***

> **MorselErrorCode** = `"EIO"` \| `"EPARSE"` \| `"ENOPLUGIN"` \| `"EVALIDATE"` \| `"ECYCLE"` \| `"EHOOK"`

Defined in: [packages/core/src/errors/morsel-error.ts:11](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/errors/morsel-error.ts#L11)

Error codes used by morsel to distinguish failure categories.

- `EIO` — filesystem errors (EACCES, EBUSY, EMFILE, disk full)
- `EPARSE` — invalid content (broken JSON/YAML/etc.)
- `ENOPLUGIN` — no format plugin found for the file extension
- `EVALIDATE` — validation plugin failure (Zod, Valibot, etc.)
- `ECYCLE` — circular `extends` detected
- `EHOOK` — hook lifecycle failure (hook.load threw)
