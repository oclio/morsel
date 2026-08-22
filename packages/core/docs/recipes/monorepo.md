# Production Recipes: Monorepos, Microservices & CLIs

Here are battle-tested patterns for structuring morsel in real-world production setups.

---

## 1. Monorepo Architecture (pnpm / Turborepo)

In a monorepo containing multiple applications or packages, you often want a shared base configuration with package-specific specializations.

### Folder Structure

```text
my-monorepo/
├── configs/
│   └── base.config.json       <-- Shared base settings
└── apps/
    ├── api-gateway/
    │   └── gateway.config.json <-- extends: "../../configs/base.config.json"
    └── billing-service/
        └── billing.config.json <-- extends: "../../configs/base.config.json"
```

### Shared Base (`configs/base.config.json`)

```json
{
  "logging": { "level": "info", "format": "json" },
  "telemetry": { "enabled": true },
  "$env": {
    "development": {
      "logging": { "format": "pretty" }
    }
  }
}
```

### Application Config (`apps/api-gateway/gateway.config.json`)

```json
{
  "extends": "../../configs/base.config.json",
  "port": 8080,
  "serviceName": "api-gateway"
}
```

---

## 2. Zero-Config CLI Tooling

When building a CLI tool, you want the tool to work out of the box with zero setup, but allow users to create an editable configuration file when needed.

```typescript
import { loadConfigSync, initConfig } from '@oclio/morsel';

export function runCli(args: string[]) {
  // 1. Support an `init` command
  if (args.includes('init')) {
    const createdPath = initConfig({
      name: 'mycli',
      content: {
        verbose: false,
        rules: ['strict-auth', 'no-dead-code'],
      },
    });
    console.log(`✨ Created configuration file: ${createdPath}`);
    return;
  }

  // 2. Load configuration with robust fallbacks
  const { config } = loadConfigSync({
    name: 'mycli',
    defaults: {
      verbose: false,
      rules: ['recommended'],
    },
    // CLI flags override everything
    overrides: {
      verbose: args.includes('--verbose') ? true : undefined,
    },
  });

  console.log(`Running with rules: ${config.rules.join(', ')}`);
}
```

---

## 3. Microservices & Daemons with Dynamic Reconnects

In long-running backend services, you can reload database connection pools or toggle features dynamically without dropping active connections or restarting the process:

```typescript
import { watchConfig } from '@oclio/morsel';

async function startServer() {
  const store = await watchConfig({
    name: 'backend',
    defaults: {
      port: 3000,
      database: { maxPoolSize: 10 },
      flags: { newSearchEngine: false },
    },
  });

  // Reconfigure database pool dynamically
  store.on('database.maxPoolSize', (newSize) => {
    console.log(`Resizing connection pool to ${newSize}...`);
    dbPool.setMaxListeners(Number(newSize));
  });

  // Hot-toggle feature flags
  store.on('flags.newSearchEngine', (enabled) => {
    console.log(`Search engine v2 enabled: ${enabled}`);
  });

  console.log(`Server listening on port ${store.config.port}`);
}

startServer();
```

---

## Next Steps

- Transition smoothly from legacy loaders with the [Migration Guide](./migration.md).
