[**@oclio/morsel**](../index.md)

***

> **resolvePaths**(`options`, `formatPlugins`): [`ResolvedPaths`](../interfaces/ResolvedPaths.md)

Defined in: [packages/core/src/paths/resolve-paths.ts:207](https://github.com/oclio/morsel/blob/8fd7afe9ac0aab0d79829dd6a93f11cf6772962a/packages/core/src/paths/resolve-paths.ts#L207)

Resolve all config file paths without reading any files.
Returns the first candidate for each (based on formatPlugins order).
Useful for `myapp config path` commands.

## Parameters

### options

[`ResolvePathsOptions`](../interfaces/ResolvePathsOptions.md)

`{ name, cwd?, globalDir? }`

### formatPlugins

readonly [`MorselFormatPlugin`](../interfaces/MorselFormatPlugin.md)[]

Ordered list of format plugins.

## Returns

[`ResolvedPaths`](../interfaces/ResolvedPaths.md)

Resolved paths for global and project config files.
