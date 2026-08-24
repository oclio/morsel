# Authoring Plugins

morsel's core is intentionally minimal and zero-dependency: it does not hardcode formats like YAML or TOML, nor does it bundle heavy validation libraries.

Instead, the entire system is built around three pluggable contracts:

1. **`MorselFormatPlugin`** — parses raw file bytes into a JavaScript object.
2. **`MorselValidationPlugin`** — validates and transforms the merged configuration.
3. **`LayerHook`** — injects dynamic layers during pipeline lifecycle stages.

---

## 1. Writing a Format Plugin (`MorselFormatPlugin`)

A format plugin teaches morsel how to parse a specific file format (e.g. YAML, TOML, JSON5, INI).

### The Contract

```typescript
export interface MorselFormatPlugin {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string, filePath: string): Record<string, unknown>;
}
```

### Complete Implementation Example: YAML Plugin

```typescript
import yaml from 'js-yaml';
import type { MorselFormatPlugin } from '@oclio/morsel';

export const yamlPlugin: MorselFormatPlugin = {
  name: 'yaml',
  extensions: ['.yaml', '.yml'],
  parse(content: string, filePath: string): Record<string, unknown> {
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  },
};
```

### What the Plugin Does vs What morsel Does

- **The Plugin**: Responsible solely for transforming `content: string` into `Record<string, unknown>`. If parsing fails, throw an error.
- **morsel Core**: Handles file reading, caching, `extends` inheritance, `$env` resolution, layer ordering, and cleanup. The plugin does not need to know about `$env` or `extends`.

### Missing Plugin Diagnostics (`ENOPLUGIN`)

If morsel finds a file with an unsupported extension on disk, it checks its static `PLUGIN_HINTS` table:

- For known packages (e.g. `.yaml`): suggests running `pnpm add @oclio/morsel-yaml`.
- For unknown extensions: suggests registering a custom `MorselFormatPlugin`.

---

## 2. Writing a Validation Plugin (`MorselValidationPlugin`)

Validation plugins ensure that the final merged configuration conforms to your application's domain rules.

### The Contract

```typescript
export interface MorselValidationPlugin {
  readonly name: string;
  validate(config: Record<string, unknown>): Record<string, unknown>;
}
```

### Golden Rule: Never Mutate the Input

Always return a **new object reference** from `validate()`. A previous validator in the chain may have returned an immutable object.

```typescript
import type { MorselValidationPlugin } from '@oclio/morsel';
import { MorselValidationError } from '@oclio/morsel';

export const portRangeValidator: MorselValidationPlugin = {
  name: 'port-range',
  validate(config) {
    if (
      typeof config.port === 'number' &&
      (config.port < 1024 || config.port > 65535)
    ) {
      throw new MorselValidationError({
        port: `Port ${config.port} must be between 1024 and 65535`,
      });
    }
    return { ...config };
  },
};
```

---

## 3. Writing a Hook Plugin (`LayerHook` / `LayerWatchableHook`)

Hooks produce dynamic layers inserted before or after core layers.

### Complete Example: Package.json Config Hook

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { LayerWatchableHook, HookContext } from '@oclio/morsel';

export function createPackageJsonHook(cwd = process.cwd()): LayerWatchableHook {
  const pkgPath = path.resolve(cwd, 'package.json');
  return {
    name: 'package-json',
    lifecycle: 'before:project', // Overridden by project config file
    watchPaths: [pkgPath],
    load(ctx: HookContext) {
      if (!fs.existsSync(pkgPath)) return {};
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return (pkg.morsel ?? {}) as Record<string, unknown>;
      } catch {
        return {};
      }
    },
  };
}
```

---

## Publishing Ecosystem Conventions

If you are developing a reusable plugin for the community or internal organization:

- Format plugins: `@oclio/morsel-<format>` (e.g. `@oclio/morsel-toml`)
- Validation plugins: `@oclio/morsel-<validator>` (e.g. `@oclio/morsel-valibot`)
- Hook plugins: `@oclio/morsel-<source>` (e.g. `@oclio/morsel-vault`)

---

## Next Steps

- Understand diagnostic error codes and tracing in [Debug & Operational Resilience](../advanced/debug-resilience.md).
- Discover built-in utility functions in [Standalone Utilities](../advanced/standalone-utilities.md).
