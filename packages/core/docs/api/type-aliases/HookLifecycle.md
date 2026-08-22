[**@oclio/morsel**](../index.md)

***

> **HookLifecycle** = `"before:defaults"` \| `"after:defaults"` \| `"before:global"` \| `"after:global"` \| `"before:project"` \| `"after:project"` \| `"before:overrides"` \| `"after:overrides"`

Defined in: [packages/core/src/hooks/types.ts:7](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/hooks/types.ts#L7)

Hook lifecycle — 8 insertion points in the pipeline.

Hooks `before:X` produce a layer that stacks **before** layer `X` (lower priority).
Hooks `after:X` produce a layer that stacks **after** layer `X` (higher priority).
