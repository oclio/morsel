# Immutability, Stable Proxy & Mutability

Handling shared state in Node.js applications is fraught with edge cases: functions mutating config objects in place, stale references retained across reloads, or race conditions during live updates.

morsel addresses this with strict **immutability guarantees** and a **stable delegating Proxy model**.

---

## The Default: `configMutability: 'frozen'`

By default, all configurations loaded by morsel (`loadConfigSync`, `loadConfig`, `watchConfig`) are **recursively frozen** (`Object.freeze` applied to every object and array).

```typescript
import { loadConfigSync } from '@oclio/morsel';

const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000 },
});

// In TypeScript strict / JavaScript strict mode:
// config.port = 8080;
// ❌ TypeError: Cannot assign to read only property 'port' of object '#<Object>'
```

### Why frozen by default?

- **Prevent accidental side-effects**: Prevents third-party dependencies or internal modules from altering the application configuration at runtime.
- **Data integrity**: Ensures that the configuration in memory always matches the merged state of your configuration sources.

---

## Live-Reload: The Stable Delegating Proxy

When using `watchConfig`, storing `const cfg = store.config` in an application service could lead to stale data if `store.config` returned a new object reference on every reload.

In `frozen` mode, morsel solves this by returning a **Stable Delegating Proxy**:

```typescript
import { watchConfig } from '@oclio/morsel';

const store = await watchConfig({
  name: 'myapp',
  defaults: { port: 3000 },
});

// 1. Capture the reference once at startup
const configRef = store.config;

console.log(configRef.port); // 3000

// ... File ./myapp.config.json is modified on disk (port changed to 8080) ...

// 2. Read through the same reference — it automatically reflects the newest state!
console.log(configRef.port); // 8080
console.log(configRef === store.config); // true (Always identical reference)
```

### How it works

- The Proxy forwards all property reads (`get`) to the store's internal current snapshot (`_config`).
- All write operations (`set`, `defineProperty`, `deleteProperty`) throw an immediate runtime error.
- You can pass `store.config` directly to your classes and services without ever needing to re-fetch it after a reload.

---

## Opting into Mutability: `configMutability: 'mutable'`

If your application architecture strictly requires modifying the configuration object in place, you can explicitly configure mutable mode:

```typescript
const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000 },
  configMutability: 'mutable',
});

// Allowed in mutable mode
config.port = 8080;
```

### Difference in `watchConfig` under `mutable` mode

- `store.config` returns a standard plain JavaScript object (no Proxy).
- On each re-merge, `store.config` is replaced with a **new object reference**.
- **Internal Deep Cloning**: To ensure that `diffKeys` and `store.on` listeners still receive accurate `(next, prev)` values (even if your application mutated the previous object in memory), morsel internally maintains a **deep clone** of `lastConfig` before exposing the new reference.

---

## Array Merge Strategies (`arrayMerge`)

When merging lists across multiple layers or files, morsel supports two strategies configured via `options.arrayMerge`:

```typescript
// Layer 1: { tags: ['auth', 'core'] }
// Layer 2: { tags: ['billing'] }
```

### 1. `'replace'` (Default)

The higher-priority array completely replaces the previous array:

```typescript
{
  tags: ['billing'];
}
```

### 2. `'concat'`

The higher-priority array is concatenated to the end of the previous array:

```typescript
{
  tags: ['auth', 'core', 'billing'];
}
```

---

## Next Steps

- Tap into pipeline stages with [Lifecycle Hooks](../extensibility/lifecycle-hooks.md).
- Enforce schema validation with [Validation Plugins](../extensibility/validation.md).
