# The Resolution Cascade

Understanding where your configuration comes from and how values are merged is essential to building predictable systems.

morsel uses a **4-layer hierarchical cascade** merged in ascending order of priority.

---

## The 4 Core Layers

```text
▲ Priority (Highest)
│
│  4. overrides   (In-code object passed to options.overrides)
│  3. project     (./<name>.config.* in cwd)
│  2. global      (~/.config/morsel/<name>.config.*)
│  1. defaults    (In-code object passed to options.defaults)
│
▼ Priority (Lowest)
```

Each subsequent layer deeply merges into the previous one, overriding matching scalar keys while preserving untouched keys.

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. DEFAULTS │ ──▶ │  2. GLOBAL   │ ──▶ │  3. PROJECT  │ ──▶ │ 4. OVERRIDES │ ──▶ FINAL CONFIG
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
  (Base values)       (~/.config/morsel)     (./myapp.config)     (Runtime flags)
```

### Layer Details

| Layer           | Source     | Location                                    | Characteristics                                                        |
| :-------------- | :--------- | :------------------------------------------ | :--------------------------------------------------------------------- |
| **`defaults`**  | Code       | `options.defaults`                          | Base fallback. `path: undefined`, `exists: true`. Cleans up `extends`. |
| **`global`**    | Filesystem | `~/.config/morsel/<name>.config.<ext>`      | User-wide configuration across multiple projects.                      |
| **`project`**   | Filesystem | `./<name>.config.<ext>` (relative to `cwd`) | Project-specific configuration committed or local to the workspace.    |
| **`overrides`** | Code       | `options.overrides`                         | Highest priority in-code values (CLI flags, runtime parameters).       |

---

## Predictable Discovery: Why morsel Does Not Traverse Upwards

Many legacy configuration loaders recursively walk up the directory tree looking for config files (from `/a/b/c` to `/a/b` to `/a` to `/`).

**morsel deliberately does not do this.**

### Why?

1. **Unpredictable Behavior**: Launching your CLI or test suite from a subdirectory (e.g. `packages/web/`) vs the project root produces different resolved configs.
2. **Performance**: Scanning dozens of parent directories introduces dozens of blocking file-system checks on every boot.
3. **Security**: Uncontrolled parent discovery can inadvertently load untrusted configuration from parent folders.

In morsel:

- **`project`** is resolved strictly in `cwd` (`process.cwd()`, or `options.cwd`).
- Cross-project or monorepo sharing is handled explicitly using the [`extends`](../configuration/inheritance.md) mechanism.

---

## Multi-Extension Discovery

When searching for `global` or `project` configuration files, morsel tests the extensions provided by registered format plugins in order.

By default, only `jsonPlugin` is active:

1. Tests `./myapp.config.json`
2. First matching file found on disk is parsed and used.

If you register additional format plugins (such as YAML or TOML):

```typescript
import { loadConfig } from '@oclio/morsel';
import { yamlPlugin } from '@oclio/morsel-yaml';

const { config } = await loadConfig({
  name: 'myapp',
  formatPlugins: [yamlPlugin], // yamlPlugin checked before default jsonPlugin
});
```

The candidate resolution order becomes:

1. `./myapp.config.yaml`
2. `./myapp.config.yml`
3. `./myapp.config.json`

The first file that exists on the filesystem wins. There are no conflicts or warnings.

---

## Inspecting Paths Without I/O: `resolvePaths`

If you need to know where morsel _expects_ configuration files to be located (for example, to display a help message or diagnostics in a CLI), use `resolvePaths`:

```typescript
import { resolvePaths, jsonPlugin } from '@oclio/morsel';

const paths = resolvePaths({ name: 'myapp', cwd: process.cwd() }, [jsonPlugin]);

console.log(paths.project); // "/Users/username/project/myapp.config.json"
console.log(paths.global); // "/Users/username/.config/morsel/myapp.config.json"
```

> **Note**: `resolvePaths` is 100% deterministic and performs zero file-system I/O. It returns the preferred theoretical paths for the highest-priority plugin extension.

---

## Auditing Resolved Layers: `result.layers`

When loading a configuration, morsel returns an array of `MorselLayer` objects tracing exactly what was discovered and merged:

```typescript
import { loadConfig } from '@oclio/morsel';

const { config, layers } = await loadConfig({
  name: 'myapp',
  defaults: { port: 3000 },
});

for (const layer of layers) {
  console.log(
    `[${layer.source}] exists: ${layer.exists}, path: ${layer.path ?? '(in-memory)'}`,
  );
  if (layer.extendsPaths.length > 0) {
    console.log(`  Inherited from: ${layer.extendsPaths.join(', ')}`);
  }
}
```

Example output:

```text
[defaults] exists: true, path: (in-memory)
[global] exists: false, path: undefined
[project] exists: true, path: /Users/username/app/myapp.config.json
  Inherited from: /Users/username/app/base.config.json
[overrides] exists: true, path: (in-memory)
```

---

## Next Steps

- Learn how to manage [TypeScript Inactive/Strict Typing](./typescript.md).
- Specialize configurations per environment with [Environments ($env)](../configuration/environments.md).
