# Environments ($env)

Managing different settings for local development, CI pipelines, staging, and production often leads to file sprawl (`config.dev.json`, `config.prod.json`, `config.test.json`).

morsel simplifies this with the **`$env` keyword**: declare environment-specific overrides directly inside your configuration files without duplicating shared keys.

---

## The `$env` Structure

Inside any configuration file (e.g. `./myapp.config.json`):

```json
{
  "api": {
    "url": "https://api.mycompany.com",
    "timeoutMs": 5000
  },
  "debug": false,
  "workers": 4,

  "$env": {
    "development": {
      "api": {
        "url": "http://localhost:4000"
      },
      "debug": true,
      "workers": 1
    },
    "ci": {
      "workers": 2,
      "api": {
        "timeoutMs": 15000
      }
    },
    "production": {
      "workers": 16
    }
  }
}
```

When loaded in `development`:

- `api.url` becomes `"http://localhost:4000"`
- `api.timeoutMs` remains `5000` (inherited from base)
- `debug` becomes `true`
- `workers` becomes `1`

---

## Environment Resolution Rules

morsel determines the active environment name using the following priority:

1. **`options.envName`** (explicit string passed in options):

   ```typescript
   const { config } = loadConfigSync({
     name: 'myapp',
     envName: 'ci', // Forces environment to 'ci'
   });
   ```

2. **`process.env.NODE_ENV`**:
   If `envName` is not provided in options, morsel defaults to the runtime `process.env.NODE_ENV` string (e.g. `"production"` or `"test"`).
3. **Undefined / No Environment**:
   If `NODE_ENV` is not set and no `envName` is supplied, `envName` is `undefined`.

### What happens when `envName` is `undefined`?

If a configuration file contains a `$env` block but `envName` is `undefined`, morsel:

- Emits a debug warning via `onDebug` (or stderr in verbose mode).
- Ignores all `$env` blocks cleanly and uses the base configuration.
- Does **not** crash the process.

---

## `$env` Application Order & Inheritance (`extends`)

A crucial architectural invariant in morsel is **per-file resolution before inheritance**:

```text
┌───────────────────────────────────────────────────────────────┐
│ 1. Read parent file ──▶ Apply parent $env[envName]            │
└───────────────────────────────────────────────────────────────┘
                                │ (merged into parent base)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. Read child file  ──▶ Apply child $env[envName]             │
└───────────────────────────────────────────────────────────────┘
                                │ (merged into child base)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. Deep-merge: child over parent                              │
└───────────────────────────────────────────────────────────────┘
```

### Why this matters

Because `$env` is applied _before_ the parent/child merge, a child file's explicit top-level values will never be unexpectedly overridden by a parent file's `$env` block. The child always retains final authority.

---

## Reserved Keyword Cleanup

`$env` is an **absolute reserved keyword** in morsel:

- It is processed during layer loading.
- It is **completely stripped** from the final `config` object and from `layer.config`.
- It will never leak into your application's business logic.

> **Rule**: If your application domain requires a business key named `env` or `$env`, rename it in your schema (e.g. `runtimeEnv`, `environmentConfig`).

---

## Next Steps

- Share and modularize configs with [Inheritance (extends)](./inheritance.md).
- Compose in-memory configurations with [Composition & Presets](./composition.md).
