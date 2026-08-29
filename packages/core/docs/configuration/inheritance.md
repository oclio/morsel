# Inheritance & Sharing (`extends`)

When building monorepos, shared tool configurations, or multi-service architectures, copying configuration across repositories is error-prone.

morsel provides an industry-standard **`extends` mechanism** allowing any configuration file to inherit settings from another local file.

---

## The `extends` Syntax

You can declare `extends` as a single relative path or an array of relative paths inside your configuration file:

### 1. Single Parent File

`./myapp.config.json`:

```json
{
  "extends": "../shared/base.config.json",
  "port": 8080
}
```

### 2. Multiple Parent Files (Ordered Array)

`./myapp.config.json`:

```json
{
  "extends": [
    "../shared/database.config.json",
    "../shared/logging.config.json"
  ],
  "serviceName": "billing-service"
}
```

When an array is provided, morsel merges the files from left to right:

1. `database.config.json` is loaded.
2. `logging.config.json` is deep-merged on top.
3. The declaring file (`myapp.config.json`) is deep-merged on top of both.

---

## Path Resolution Rules

Paths in `extends` are **always resolved relative to the directory of the file declaring the `extends` property** — never relative to the global process `cwd`.

```text
/workspace/
├── configs/
│   └── base.json
└── services/
    └── billing/
        └── billing.config.json  <-- extends: "../../configs/base.json"
```

Because paths are relative to the declaring file, nested extends chains can be safely relocated without breaking parent references.

---

## Recursive Chains & Safety

An inherited configuration file can itself declare `extends` to create a multi-level inheritance tree.

To prevent infinite loops and runaway recursion, morsel implements strict safety invariants:

1. **Cycle Detection (`ECYCLE`)**:
   morsel tracks all visited file paths in a `Set`. If file `A.json` extends `B.json`, and `B.json` extends `A.json`, morsel immediately halts and throws a `MorselError` with code `ECYCLE`.
2. **Maximum Recursion Depth (`MAX_DEPTH = 10`)**:
   Inheritance chains deeper than 10 levels are rejected with `ECYCLE` to protect system memory and execution stack limits.

---

## Live-Reload & Watch Integration

When running under `createReactiveStore`:

- morsel registers directory watchers for **every file in the `extends` chain**.
- If a shared parent configuration (`../shared/base.config.json`) is edited on disk, morsel automatically detects the event, re-merges the entire cascade, and emits granular key-level changes to all active listeners.

---

## Explicit Non-Goals: Local Files Only

morsel intentionally **does not support remote URLs or package specifiers** in `extends` (e.g. `extends: "https://example.com/config.json"` or `extends: "gh:org/repo"`):

- **Security**: Loading executable or structured configuration from external network endpoints expands the supply-chain attack surface.
- **Reliability & Offline Support**: Network hiccups or DNS failures should never prevent a Node.js process from loading its local configuration.
- **Determinism**: Local file paths guarantee that your configuration stays fast and fully reproducible.

---

## Reserved Keyword Cleanup

Like `$env`, `extends` is an **absolute reserved keyword**:

- It is processed and resolved internally during file loading.
- It is **stripped** from the final `config` object and never exposed in the runtime data structure.

---

## Next Steps

- Learn how to compose configurations in code with [Composition & Presets](./composition.md).
- Create initial project files easily with [Project Bootstrapping (initConfig)](./bootstrapping.md).
