# Migration Guide: Moving to morsel

If your project currently uses legacy loaders like `cosmiconfig`, `node-config`, `rc`, or `conf`, this guide will help you transition to morsel with zero downtime.

---

## Comparison Matrix

| Feature                       | cosmiconfig | lilconfig | node-config |   conf    |    rc     |              morsel               |
| :---------------------------- | :---------: | :-------: | :---------: | :-------: | :-------: | :-------------------------------: |
| **Zero Runtime Dependencies** |     ❌      |    ✅     |     ❌      |    ❌     |    ❌     |          **✅ (<8 KB)**           |
| **Live-Reload (fs.watch)**    |     ❌      |    ❌     |     ❌      |    ❌     |    ❌     |              **✅**               |
| **Key-Level Granular Events** |     ❌      |    ❌     |     ❌      |    ❌     |    ❌     |              **✅**               |
| **Multi-Layer Cascade Merge** |     ❌      |    ❌     |     ✅      |    ❌     |    ✅     |         **✅ (4 layers)**         |
| **Pluggable Architecture**    |   partial   |  partial  |     ❌      |    ❌     |    ❌     | **✅ (Formats/Validators/Hooks)** |
| **Native ESM & CJS**          |     ✅      |  partial  |   broken    |    ✅     |    ❌     |              **✅**               |
| **Async + Sync First-Class**  | async only  | sync only |  sync only  | sync only | sync only |              **✅**               |
| **Immutable by Default**      |     ❌      |    ❌     |     ✅      |    ❌     |    ❌     |              **✅**               |

---

## 1. Migrating from `cosmiconfig`

`cosmiconfig` focuses primarily on single-file discovery with search upwards.

### Before (cosmiconfig)

```typescript
import { cosmiconfig } from 'cosmiconfig';

const explorer = cosmiconfig('myapp');
const result = await explorer.search();

const config = result?.config ?? { port: 3000 };
```

### After (morsel)

```typescript
import { loadConfig } from '@oclio/morsel';

const { config } = await loadConfig({
  name: 'myapp',
  defaults: { port: 3000 },
});
```

### Key Differences

- **Zero-Dep**: morsel removes transitive dependencies like `path-type`, `import-fresh`, and `js-yaml`.
- **Hierarchical Merge**: morsel blends defaults, global user settings, and project files automatically.

---

## 2. Migrating from `node-config`

`node-config` relies on a static `./config/` directory with global singleton mutable state.

### Before (node-config)

```typescript
// Reads config/default.json, config/production.json, etc.
import config from 'config';

const port = config.get<number>('port');
```

### After (morsel)

Replace the multi-file directory with a single `./myapp.config.json` using the `$env` structure:

```json
{
  "port": 3000,
  "$env": {
    "production": {
      "port": 8080
    }
  }
}
```

In code:

```typescript
import { loadConfigSync } from '@oclio/morsel';

const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000 },
});

console.log(config.port); // Directly typed property access
```

### Key Differences

- **No Global Mutation**: You instantiate configs cleanly rather than relying on global singleton state.
- **Async & Reactive Support**: You can use `loadConfig` (async) or `watchConfig` (reactive live-reload).
- **TypeScript Autocomplete**: Access properties naturally as `config.port` without typing strings into `config.get('port')`.

---

## Summary

Migrating to morsel gives your project:

1. **Lighter bundle size and cleaner dependency trees**.
2. **Instant live-reload capabilities without architectural rewrites**.
3. **Strict type inference and immutability by default**.
