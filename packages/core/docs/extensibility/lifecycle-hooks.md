# Lifecycle Hooks (`LayerHook`)

Modern applications often need to inject configuration dynamically from outside the standard filesystem cascade — such as reading environment variables, parsing `package.json`, decrypting secrets, or reading from a local daemon.

morsel provides **Lifecycle Hooks (`LayerHook`)** to intercept specific stages of the resolution pipeline and insert dynamic layers.

---

## The 8 Lifecycle Points

Hooks can hook `before` or `after` any of the 4 core layers:

```text
┌─────────────────┐
│ before:defaults │
├─────────────────┤
│    defaults     │  (In-memory options.defaults)
├─────────────────┤
│ after:defaults  │
├─────────────────┤
│  before:global  │
├─────────────────┤
│     global      │  (~/.config/morsel/<name>.config.*)
├─────────────────┤
│  after:global   │
├─────────────────┤
│ before:project  │
├─────────────────┤
│     project     │  (./<name>.config.* in cwd)
├─────────────────┤
│  after:project  │
├─────────────────┤
│before:overrides │
├─────────────────┤
│    overrides    │  (In-memory options.overrides)
├─────────────────┤
│ after:overrides │
└─────────────────┘
         │
         ▼
    Deep Merge
         │
         ▼
  Post-Merge Validation
```

- A hook registered at `before:project` produces a layer that will be evaluated **before** the project file is merged.
- A hook registered at `after:project` produces a layer that will **override** the project file, but can still be overridden by `overrides`.

---

## The Hook Contract: `LayerHook`

A hook is a **stateless** object defining:

- `name`: Unique identifier (e.g. `'env'`, `'package-json'`).
- `lifecycle`: One of the 8 lifecycle points.
- `load(ctx: HookContext)`: Function returning a `Record<string, unknown>` or a `Promise<Record<string, unknown>>`.

```typescript
import type { LayerHook, HookContext } from '@oclio/morsel';

export const envHook: LayerHook = {
  name: 'env',
  lifecycle: 'after:project', // Overrides project config, but lower than code overrides
  load(ctx: HookContext) {
    return {
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
      databaseUrl: process.env.DATABASE_URL,
    };
  },
};
```

---

## Watchable Hooks: `LayerWatchableHook`

If a hook reads from external files on disk (e.g. a `.env` file or `package.json`), it can implement `LayerWatchableHook` by providing a `watchPaths` array:

```typescript
import path from 'node:path';
import fs from 'node:fs';
import type { LayerWatchableHook, HookContext } from '@oclio/morsel';

export function createEnvFileHook(envPath: string): LayerWatchableHook {
  return {
    name: 'dotenv',
    lifecycle: 'after:defaults',
    watchPaths: [envPath], // morsel will watch this path under watchConfig!
    load(ctx: HookContext) {
      if (!fs.existsSync(envPath)) {
        return {};
      }
      const raw = fs.readFileSync(envPath, 'utf8');
      // Simple parser example
      const result: Record<string, unknown> = {};
      for (const line of raw.split('\n')) {
        const [k, v] = line.split('=');
        if (k && v) result[k.trim()] = v.trim();
      }
      return result;
    },
  };
}
```

When used with `watchConfig`:

- morsel registers directory watchers for all paths listed in `hook.watchPaths`.
- Any edit to `.env` triggers an automatic live-reload and re-merges the entire configuration pipeline.

---

## Synchronous vs Asynchronous Hooks

Hooks can return either a plain object or a `Promise`:

- **`loadConfig` & `watchConfig`**: Both synchronous and asynchronous hooks are fully awaited.
- **`loadConfigSync`**: If any registered hook returns a `Promise`, `loadConfigSync` immediately throws:

  ```text
  TypeError: morsel: hook "vault" is async — use loadConfig or watchConfig
  ```

---

## Error Handling (`EHOOK`)

If an unhandled exception occurs inside `hook.load()`:

- **One-shot modes (`loadConfig` / `loadConfigSync`) & Initial watch boot**: Wrapped in a `MorselError` with code `EHOOK` and thrown immediately.
- **Runtime watch re-merge**: Caught internally, logged via `onDebug`/`stderr`, and the store safely retains its previous valid configuration state.

---

## Next Steps

- Validate and transform configs with [Validation Plugins](./validation.md).
- Learn how to author custom plugins in [Authoring Plugins](./authoring-plugins.md).
