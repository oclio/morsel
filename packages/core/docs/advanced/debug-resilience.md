# Debug, Error Codes & Operational Resilience

When developing or running configuration loaders in production, silent failures lead to hard-to-diagnose bugs.

morsel provides **explicit error codes, structured error classes, configurable debug channels**, and automatic **operational self-healing**.

---

## Error Hierarchy & `ErrorCode`

All operational errors thrown or caught by morsel are instances of `MorselError`:

```typescript
export class MorselError extends Error {
  readonly path: string | undefined;
  readonly code: ErrorCode;
  readonly cause: NodeJS.ErrnoException | Error;
}
```

### Supported Error Codes

| Code            | Error Type         | Cause / Trigger                                          | Behavior                                               |
| :-------------- | :----------------- | :------------------------------------------------------- | :----------------------------------------------------- |
| **`EIO`**       | Filesystem I/O     | `EACCES`, `EBUSY`, disk full, permission denied          | Throws in one-shot; logs in watch re-merge.            |
| **`EPARSE`**    | Syntax Error       | Malformed JSON/YAML/TOML in an existing file             | Throws in one-shot; preserves previous state in watch. |
| **`ENOPLUGIN`** | Missing Plugin     | File extension found on disk without a registered parser | Throws with install hints (e.g. `@oclio/morsel-yaml`). |
| **`EVALIDATE`** | Validation Failure | Schema rejection by a `ValidationPlugin`                 | Throws `ValidationError` with issues map.              |
| **`ECYCLE`**    | Circular Extends   | Circular `extends` reference or depth > 10               | Throws immediately to prevent infinite recursion.      |
| **`EHOOK`**     | Hook Failure       | Unhandled exception thrown inside `hook.load()`          | Throws in one-shot; logs in watch re-merge.            |

> **Note**: `ENOENT` (file not found) is **not an error**. Missing files are normal in layered configuration — they produce `exists: false` and an empty config layer `{}`.

---

## Logging & Debug Channels

morsel provides three levels of visibility:

```typescript
import { loadConfig } from '@oclio/morsel';

const { config } = await loadConfig({
  name: 'myapp',
  defaults: { port: 3000 },

  // 1. Enable full debug traces
  verbose: true,

  // 2. Custom log sink (or () => {} to silence completely)
  onDebug(message, context) {
    console.debug(`[morsel] ${message}`, context);
  },
});
```

### Channel Precedence

1. If `onDebug` is provided: all debug logs, warnings, and non-fatal re-merge errors are routed to `onDebug`.
2. If `onDebug` is omitted: fatal syntax errors and unexpected watch failures are logged to `process.stderr`.
3. If `verbose: true`: detailed resolution traces, watcher registrations, and debounce timers are emitted.

---

## Operational Resilience in Watch Mode

In production or development watch modes, temporary filesystem anomalies happen:

### 1. Temporary Syntax Errors

If a developer saves a broken JSON file mid-edit:

- `watchConfig` intercepts the `EPARSE` error.
- The error is logged to `onDebug` / `stderr`.
- `store.config` **remains frozen at the last known valid state**.
- Your web server or service continues running without interruption.
- Once the file is fixed and saved, the next re-merge succeeds and updates the configuration.

### 2. Directory Deletion & Re-attachment Polling

If the project or global directory is deleted (e.g. during a git branch switch or clean script):

- `fs.watch` drops the underlying file descriptor.
- morsel initiates background polling (`existsSync` every 1 second).
- When the directory is recreated, watchers are re-attached transparently and a re-merge is triggered.

---

## Next Steps

- Explore built-in data manipulation helpers in [Standalone Utilities](./standalone-utilities.md).
- Learn real-world architectural patterns in [Production Recipes](../recipes/monorepo.md).
