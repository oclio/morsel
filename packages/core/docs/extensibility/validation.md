# Schema Validation (`ValidationPlugin`)

Configuration errors (missing fields, incorrect types, invalid formats) should fail fast with clear, actionable diagnostics before your application starts listening on ports or establishing database connections.

morsel keeps its core runtime zero-dependency by treating validation as a **decoupled post-merge plugin contract**.

---

## The Validation Pipeline

Validation plugins run at the very end of the resolution pipeline, **after all layers and hooks have been merged**:

```text
Cascade (defaults → global → project → overrides → hooks)
                          │
                          ▼
                      Deep Merge
                          │
                          ▼
            [Validation Plugin 1: Zod / Valibot]
                          │ (validated / transformed config)
                          ▼
            [Validation Plugin 2: Custom rules]
                          │
                          ▼
            Apply Mutability (Object.freeze)
                          │
                          ▼
                     Final Config
```

---

## Writing a Validation Plugin (Zod Example)

You can wrap any schema validator (Zod, Valibot, ArkType, Yup) into a `ValidationPlugin` in just a few lines:

```typescript
import { z } from 'zod';
import { loadConfigSync, ValidationError } from '@oclio/morsel';
import type { ValidationPlugin } from '@oclio/morsel';

export function createZodValidator(schema: z.ZodTypeAny): ValidationPlugin {
  return {
    name: 'zod',
    validate(config: Record<string, unknown>) {
      const result = schema.safeParse(config);
      if (result.success) {
        // Return validated (and potentially transformed/coerced) config
        return result.data as Record<string, unknown>;
      }

      // Format issues map: "path.to.key" -> "error message"
      const issues: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const keyPath = issue.path.join('.') || 'root';
        issues[keyPath] = issue.message;
      }

      throw new ValidationError(issues);
    },
  };
}
```

---

## Using the Validation Plugin

Pass your validator inside `options.validationPlugins`:

```typescript
const AppSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  host: z.string().default('0.0.0.0'),
  apiKey: z.string().min(10, 'apiKey must be at least 10 chars'),
});

const { config } = loadConfigSync({
  name: 'myapp',
  defaults: { port: 3000 },
  validationPlugins: [createZodValidator(AppSchema)],
});
```

If `./myapp.config.json` contains:

```json
{ "port": 80, "apiKey": "short" }
```

morsel throws a formatted `ValidationError`:

```text
ValidationError [EVALIDATE]:
  - port: Number must be greater than or equal to 1024
  - apiKey: apiKey must be at least 10 chars
```

---

## Validation & Transformation Guarantees

1. **Config Transformation Allowed**:
   Validators can perform type coercion, strip unneeded keys, or apply default values. The output of validator `N` becomes the input to validator `N+1`.
2. **Never Mutate the Input**:
   Always return a **new object reference** from `validate()`. A previous validator may have returned a frozen object.
3. **Core Passes Mutable Objects to Validators**:
   `applyMutability` (such as `Object.freeze`) is applied only **after** the entire validation plugin chain has successfully finished.

---

## Error Handling (`EVALIDATE`)

- **In One-Shot Mode (`loadConfig` / `loadConfigSync`)**:
  Throws `ValidationError` immediately, preventing invalid boots.
- **In Live-Reload Mode (`watchConfig`)**:
  - Initial boot: throws `ValidationError` immediately.
  - Runtime re-merge: catches `ValidationError`, logs the validation issues via `onDebug`/`stderr`, and **keeps the last valid configuration intact**.

---

## Next Steps

- Build custom format parsers, validators, and hooks in [Authoring Plugins](./authoring-plugins.md).
- Master diagnostics and error codes in [Debug & Operational Resilience](../advanced/debug-resilience.md).
