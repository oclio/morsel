# Project Bootstrapping (`initConfig`)

When creating a CLI tool, developer framework, or new project template, you often want to initialize a default configuration file on disk for the user if one does not already exist.

morsel provides the `initConfig` helper for safe, idempotent bootstrapping.

---

## Usage: `initConfig`

`initConfig` checks if a configuration file already exists in the target directory. If none is found, it writes an initial JSON configuration file:

```typescript
import { initConfig } from '@oclio/morsel';

const configPath = initConfig({
  name: 'myapp',
  cwd: process.cwd(),
  content: {
    port: 3000,
    features: {
      metrics: true,
      darkMode: false,
    },
  },
});

console.log(`Config initialized at: ${configPath}`);
```

---

## Idempotence & Safe Guarantees

`initConfig` follows strict safety invariants:

1. **Existence Check (`resolveProjectPathSync`)**:
   Before writing anything, morsel checks if `./<name>.config.<ext>` exists for _any_ registered extension (including `.yaml`, `.toml`, etc.). If a matching configuration file already exists, **nothing is written**, and `initConfig` returns the existing path immediately.
2. **Atomic Writes**:
   When creating the file, morsel writes the formatted JSON content to a temporary file (`<path>.tmp`) first, then atomically renames it to `<path>`. This protects against partial/corrupted files if the process is killed mid-write.
3. **Directory Creation**:
   Parent directories are created recursively if they do not yet exist (`mkdirSync(..., { recursive: true })`).
4. **JSON Formatting**:
   Written content is formatted with 2-space indentation and a trailing newline.

---

## Content Precedence

`initConfig` accepts both `content` and `fallbackContent`:

```typescript
initConfig({
  name: 'myapp',
  // Preferred content
  content: { port: 8080 },
  // Fallback used only if content is undefined
  fallbackContent: { port: 3000 },
});
```

- If `content` is provided: `content` is written.
- If `content` is omitted: `fallbackContent` is written.
- If both are omitted: an empty object `{}` is written.

---

## Seamless Watcher Integration

If your application has already initialized a watcher via `watchConfig`, calling `initConfig` writes the file to disk atomically.

The active directory watcher will immediately capture the file creation, trigger a live re-merge, and dispatch granular key updates to all registered listeners without requiring any custom synchronization code.

---

## Next Steps

- Explore real-time live-reloading in [Live-Reload & Watch](../reactivity/live-reload.md).
- Master granular subscriptions with [Key-Level Events](../reactivity/key-events.md).
