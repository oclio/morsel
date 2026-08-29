# Quick Start

Welcome to **morsel** — the lean, zero-dependency configuration loader for Node.js featuring auto-discovery, hierarchical cascading merge, key-level live-reloading, and a fully decoupled plugin pipeline.

---

## Installation

Install `@oclio/morsel` using your preferred package manager:

```bash
# pnpm
pnpm add @oclio/morsel

# npm
npm install @oclio/morsel

# yarn
yarn add @oclio/morsel
```

> **Requirements**: Node.js `>= 18.0.0`. Zero runtime dependencies. ESM and CJS supported out of the box.

---

## 5-Line Quick Start

Create a minimal configuration loader in your application:

```typescript
import { loadConfigSync } from '@oclio/morsel';

const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000, host: 'localhost' },
});

console.log(`Server starting on http://${config.host}:${config.port}`);
```

When this runs, morsel:

1. Takes your `defaults`.
2. Searches for global configuration in `~/.config/morsel/myapp.config.json`.
3. Searches for project configuration in `./myapp.config.json` (relative to `process.cwd()`).
4. Merges all layers in order with full type-safety.

---

## Choosing Your Loader Function

morsel provides three distinct functions. The function you choose determines the behavior — there is no confusing `watch: true` or `sync: true` flag.

```text
┌─────────────────────────┬──────────────────┬─────────────────────────────────────────────────┐
│ Function                │ Execution Mode   │ Best For                                        │
├─────────────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ loadConfigSync(options) │ Synchronous      │ CLI tools, build scripts, synchronous boots     │
│ loadConfig(options)     │ Asynchronous     │ Web services, parallel boots (Promise.all)      │
│ createReactiveStore(options)    │ Async + Reactive │ Live-reload servers, reactive daemons, desktop  │
└─────────────────────────┴──────────────────┴─────────────────────────────────────────────────┘
```

### 1. Synchronous One-Shot: `loadConfigSync`

Ideal for command-line tools or scripts where blocking the event loop during initial startup is acceptable:

```typescript
import { loadConfigSync } from '@oclio/morsel';

const { config, layers } = loadConfigSync({
  name: 'myapp',
  defaults: {
    debug: false,
    outputDir: './dist',
  },
});
```

### 2. Asynchronous One-Shot: `loadConfig`

Ideal for web services or microservices where non-blocking I/O is preferred, especially when loading multiple configs concurrently:

```typescript
import { loadConfig } from '@oclio/morsel';

const [{ config: appConfig }, { config: dbConfig }] = await Promise.all([
  loadConfig({ name: 'myapp', defaults: { port: 3000 } }),
  loadConfig({ name: 'database', defaults: { poolSize: 10 } }),
]);
```

### 3. Reactive Live-Reload: `createReactiveStore`

Ideal for long-running servers and background services that need to react to configuration changes without restarting:

```typescript
import { createReactiveStore } from '@oclio/morsel';

const store = await createReactiveStore({
  name: 'myapp',
  defaults: {
    logLevel: 'info',
    features: { betaAccess: false },
  },
  watchDebounce: 300, // debounce time in ms (default: 300)
});

// Subscribe to granular, key-level mutations using dotted notation
store.on('logLevel', (next, prev) => {
  console.log(`Log level changed: ${prev} → ${next}`);
});

store.on('features.betaAccess', (enabled) => {
  console.log(`Beta feature access toggled: ${enabled}`);
});

// store.config is a stable Proxy — always holds the freshest values
console.log(`Current log level: ${store.config.logLevel}`);

// Clean up when shutting down
process.on('SIGTERM', async () => {
  await store.stop();
  process.exit(0);
});
```

---

## The morsel Guarantees

- **Zero Runtime Dependencies**: Pure Node.js built-ins (`node:fs`, `node:path`, `node:os`). No supply-chain bloat.
- **Fail-Fast & Explicit**: No silent fallbacks. Syntax errors in existing files immediately throw typed `MorselError` instances in one-shot modes.
- **Immutable by Default**: The returned configuration is recursively frozen (`Object.freeze`), protecting against accidental in-memory mutations.
- **Pluggable Architecture**: Native JSON support built-in; formats like YAML/TOML and validators like Zod plug into a lightweight lifecycle without adding weight to the core.

---

## Next Steps

- Understand the [Resolution Cascade](./resolution-cascade.md) to see where morsel looks for your files.
- Master [TypeScript Inference & Typing](./typescript.md) without manual type assertions.
