# Standalone Utilities (`deepMerge`, `diffKeys`, `flatten`)

morsel exports several of its core algorithmic building blocks as standalone functions. You can use these utilities in your own tools, custom plugins, or scripts without pulling in heavy external dependencies.

---

## 1. `deepMerge(base, override, strategy)`

Recursively merges two objects with full control over array merging strategies:

```typescript
import { deepMerge } from '@oclio/morsel';

const base = {
  server: { port: 3000, host: 'localhost' },
  plugins: ['auth'],
};

const override = {
  server: { port: 8080 },
  plugins: ['metrics'],
};

// 1. Default / 'replace' strategy (arrays replaced)
const replaced = deepMerge(base, override, 'replace');
// {
//   server: { port: 8080, host: 'localhost' },
//   plugins: ['metrics']
// }

// 2. 'concat' strategy (arrays concatenated)
const concatenated = deepMerge(base, override, 'concat');
// {
//   server: { port: 8080, host: 'localhost' },
//   plugins: ['auth', 'metrics']
// }
```

### Deep Merge Rules

- **Objects**: Recursively merged.
- **Arrays**: Replaced or concatenated according to `strategy`.
- **Scalars**: Overwritten.
- **`undefined` in override**: Ignored (does not overwrite).
- **`null` in override**: Overwrites (used to reset a property explicitly).

---

## 2. `diffKeys(oldObj, newObj)`

Computes a structural, recursive delta between two objects, returning a `Map` of dotted key paths to `KeyChange` records:

```typescript
import { diffKeys } from '@oclio/morsel';

const oldConfig = {
  port: 3000,
  database: { maxPool: 10, timeoutMs: 5000 },
  featureFlags: ['beta'],
};

const newConfig = {
  port: 8080,
  database: { maxPool: 20 }, // timeoutMs removed
  featureFlags: ['beta', 'v2'],
  logging: true, // logging added
};

const diff = diffKeys(oldConfig, newConfig);

for (const [key, change] of diff) {
  console.log(`${key} [${change.category}]:`, {
    prev: change.prev,
    next: change.next,
  });
}
```

Output:

```text
port [modified]: { prev: 3000, next: 8080 }
database.maxPool [modified]: { prev: 10, next: 20 }
database.timeoutMs [removed]: { prev: 5000, next: undefined }
featureFlags [modified]: { prev: ['beta'], next: ['beta', 'v2'] }
logging [added]: { prev: undefined, next: true }
```

---

## 3. `flatten(obj)`

Flattens a deeply nested JavaScript object into a single-level `Map` with dotted string keys:

```typescript
import { flatten } from '@oclio/morsel';

const nested = {
  app: {
    name: 'morsel',
    network: {
      port: 3000,
      cors: true,
    },
  },
  tags: ['fast', 'zero-dep'],
};

const flatMap = flatten(nested);

console.log(flatMap.get('app.network.port')); // 3000
console.log(flatMap.get('tags')); // ['fast', 'zero-dep'] (arrays are preserved as atomic values)
```

> **Note**: `flatten` stops recursing at arrays and non-plain objects, preserving them as individual values.

---

## Next Steps

- Explore practical architectures in [Production Recipes](../recipes/monorepo.md).
- Switch from existing tools in the [Migration Guide](../recipes/migration.md).
