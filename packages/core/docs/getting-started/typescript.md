# TypeScript & Type Inference

morsel is designed from the ground up to provide seamless TypeScript developer experience without requiring manual type casting (`as MyConfig`) or complex schema boilerplate for standard usage.

---

## Automatic Inference from `defaults`

The simplest and most robust way to get full autocomplete and type safety is to provide a `defaults` object. TypeScript will automatically infer the configuration shape `T`:

```typescript
import { loadConfigSync } from '@oclio/morsel';

const { config } = loadConfigSync({
  name: 'myapp',
  defaults: {
    port: 3000,
    host: 'localhost',
    database: {
      ssl: false,
      poolSize: 5,
    },
  },
});

// TypeScript knows the exact types:
// config.port: number
// config.host: string
// config.database.ssl: boolean
// config.database.poolSize: number
console.log(config.port, config.database.ssl);
```

---

## Defining Type Contracts with `defineConfig`

When authoring configuration presets, plugins, or reusable setup functions, use `defineConfig`. It validates the options structure at compile time and infers the generic type parameter `T`:

```typescript
import { defineConfig, loadConfig } from '@oclio/morsel';

// myapp.config.ts
export const appConfigDef = defineConfig({
  name: 'myapp',
  defaults: {
    apiUrl: 'https://api.example.com',
    timeoutMs: 5000,
    retryAttempts: 3,
  },
});

// In your application startup:
const { config } = await loadConfig(appConfigDef);
console.log(config.apiUrl); // Autocompleted as string
```

---

## The `defaults` Strictness Rule

In morsel, **`options.defaults` defines the strict TypeScript contract** of the resulting `config` object when generic type inference is used.

### What happens if a file on disk adds a new key?

Imagine `./myapp.config.json` contains:

```json
{
  "port": 8080,
  "metricsPort": 9090
}
```

If your code defines:

```typescript
const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000 },
});
```

- **At Runtime**: `config.metricsPort` exists and equals `9090` (morsel does not strip unknown keys during merge).
- **At Compile Time**: `config.metricsPort` will produce a TypeScript compilation error because `metricsPort` was not present in `defaults`.

### Solution 1: Declare Optional Keys in `defaults`

Set the optional key to `undefined` or a sensible fallback:

```typescript
const { config } = loadConfigSync({
  name: 'myapp',
  defaults: {
    port: 3000,
    metricsPort: undefined as number | undefined,
  },
});

if (config.metricsPort) {
  console.log(`Metrics enabled on port ${config.metricsPort}`);
}
```

### Solution 2: Explicit Generic Interface

If you prefer a dedicated TypeScript interface, pass it explicitly to the loader:

```typescript
import { loadConfigSync } from '@oclio/morsel';

interface MyAppConfig {
  port: number;
  metricsPort?: number;
  tags?: string[];
}

const { config } = loadConfigSync<MyAppConfig>({
  name: 'myapp',
  defaults: {
    port: 3000,
  },
});

// TypeScript compiles:
console.log(config.metricsPort); // type: number | undefined
```

> **Priority Rule**: An explicit generic parameter (e.g. `loadConfig<MyAppConfig>({...})`) always takes precedence over inference from `defaults`. If `defaults` is omitted and no generic is provided, `T` falls back to `Record<string, unknown>`.

---

## Reactive Store Typing with `watchConfig`

When using `watchConfig`, `MorselStore<T>` preserves the same typed interface for `store.config`:

```typescript
import { watchConfig } from '@oclio/morsel';

interface ServerConfig {
  http: {
    port: number;
    cors: boolean;
  };
}

const store = await watchConfig<ServerConfig>({
  name: 'myapp',
  defaults: {
    http: {
      port: 8080,
      cors: true,
    },
  },
});

// store.config is strictly typed as ServerConfig
console.log(store.config.http.port);
```

---

## Next Steps

- Specialize configs for dev, test, and prod with [Environments ($env)](../configuration/environments.md).
- Share common base configurations with [Inheritance (extends)](../configuration/inheritance.md).
