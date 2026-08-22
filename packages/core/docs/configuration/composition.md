# Composition & Presets (`defineConfig`, `mergeConfig`)

When building modular systems, libraries, or reusable tooling, you often need to define base configuration presets and allow users or environments to override specific settings in code.

morsel exports two dedicated helpers for this: `defineConfig` and `mergeConfig`.

---

## Type-Safe Presets with `defineConfig`

`defineConfig` is a lightweight helper that validates your options shape at compile time while providing full TypeScript type inference:

```typescript
import { defineConfig } from '@oclio/morsel';

export const baseConfig = defineConfig({
  name: 'myapp',
  defaults: {
    port: 3000,
    host: 'localhost',
    security: {
      enableCors: true,
      rateLimitPerMinute: 100,
    },
  },
  arrayMerge: 'replace',
  configMutability: 'frozen',
});
```

---

## Composing Configurations with `mergeConfig`

`mergeConfig(base, overrides)` allows you to combine two `MorselOptions` objects into a unified definition:

```typescript
import { defineConfig, mergeConfig, loadConfig } from '@oclio/morsel';

// 1. Declare base preset
const basePreset = defineConfig({
  name: 'myapp',
  defaults: {
    port: 3000,
    workers: 2,
    logging: { level: 'info', format: 'pretty' },
  },
});

// 2. Derive a production preset
const productionConfig = mergeConfig(basePreset, {
  defaults: {
    workers: 8,
    logging: { format: 'json' },
  },
  verbose: false,
});

// 3. Load the composed configuration
const { config } = await loadConfig(productionConfig);
console.log(config.workers); // 8
console.log(config.port); // 3000 (preserved from base)
console.log(config.logging.format); // 'json'
```

---

## Merge Rules: Deep Merge vs Replacement

When using `mergeConfig`, different options properties follow distinct merging semantics:

### 1. Data Properties (`defaults`, `overrides`)

- Merged **recursively** using deep-merge.
- Nested object keys in `overrides` overwrite corresponding keys in `base`, while sibling keys are preserved.

### 2. Scalar Configuration Properties (`name`, `cwd`, `globalDir`, `verbose`, etc.)

- Overwritten by `overrides` if provided; otherwise retained from `base`.

### 3. Plugin & Hook Arrays (`formatPlugins`, `validationPlugins`, `hooks`)

- **Important**: Arrays of plugins and hooks are **replaced**, not concatenated.
- If `overrides.formatPlugins` is provided, it completely replaces `base.formatPlugins`.

#### Why plugin arrays are replaced

Implicit array concatenation can introduce duplicate plugins or unexpected plugin evaluation order. If you want to append a plugin to an existing base preset, do so explicitly:

```typescript
import { mergeConfig } from '@oclio/morsel';
import { yamlPlugin } from '@oclio/morsel-yaml';

const customConfig = mergeConfig(basePreset, {
  formatPlugins: [...(basePreset.formatPlugins ?? []), yamlPlugin],
});
```

---

## Next Steps

- Bootstrap new project files with [Project Bootstrapping (initConfig)](./bootstrapping.md).
- Learn about live-reloading with [Live-Reload & Watch](../reactivity/live-reload.md).
