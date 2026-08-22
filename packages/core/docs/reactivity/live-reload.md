# Live-Reload & Watch (`watchConfig`)

Building long-running services (HTTP servers, daemons, background workers) usually requires restarting the process whenever configuration files change.

morsel's `watchConfig` provides robust, zero-downtime **live-reloading with native file watching**, intelligent debouncing, and automatic self-healing.

---

## Starting the Watcher: `watchConfig`

`watchConfig` returns a promise resolving to a `MorselStore<T>`:

```typescript
import { watchConfig } from '@oclio/morsel';

const store = await watchConfig({
  name: 'myapp',
  defaults: {
    port: 3000,
    database: { maxConnections: 10 },
  },
  watchDebounce: 300, // Debounce time in ms (default: 300)
});

console.log(`Initial port: ${store.config.port}`);

// Listen to changes on specific keys
store.on('database.maxConnections', (next, prev) => {
  console.log(`DB pool resized: ${prev} → ${next}`);
});
```

---

## Architecture: Why Directory-Level Watching?

Most simple file watchers attach directly to a specific file (e.g. `fs.watch('myapp.config.json')`).

### The problem with file-level watching

Modern IDEs and code editors (VS Code, Vim, IntelliJ) save files atomically: they write to a temporary file, delete the original, and rename the temporary file into place. A watcher attached directly to the original file descriptor is dropped or emits broken `ENOENT` events.

### The morsel solution

morsel attaches `fs.watch` to the **containing directory** and filters incoming filesystem events by filename:

- **Survives file deletion and recreation**: When an editor replaces the file, the directory watcher captures the rename transparently.
- **Watches extends directories**: Every directory containing a file in the `extends` chain is automatically monitored.
- **Watches hook paths**: Custom paths declared by `MorselWatchableHook` instances are monitored within the same registry.

---

## Watcher Ref-Counting

To keep memory and OS file descriptor usage minimal, morsel maintains an internal **Watcher Registry**:

- Exactly **one `fs.watch` instance is created per unique directory**, even if multiple stores or configurations monitor files in the same folder.
- Watcher references are counted (`refCount`).
- When a store calls `store.stop()`, the reference count is decremented. When it reaches 0, the underlying `fs.FSWatcher` is closed.

---

## Debouncing & Concurrent Re-Merges

Editors often fire multiple filesystem events within a fraction of a second when saving a file.

1. **Per-Store Debouncing (`watchDebounce = 300ms`)**:
   Events are debounced independently per store. A store configured with a 100ms debounce will react faster without affecting a store configured with a 500ms debounce sharing the same directory.
2. **Concurrent Re-Merge Queue (`pendingRemerge`)**:
   If a new file change occurs while a previous asynchronous re-merge is already running:
   - morsel marks `pendingRemerge = true`.
   - The current re-merge finishes cleanly.
   - A subsequent re-merge is automatically scheduled in the `finally` block.
   - No events are dropped, and no mutex locks block the event loop.

---

## Self-Healing & Resilience Guarantees

In long-running environments, transient errors are inevitable (e.g., someone temporarily saves a malformed JSON file or moves a folder).

morsel handles these failures with strict resilience guarantees:

### 1. Initial Boot vs Runtime Re-merge

- **Boot (First load)**: If the initial file load fails (syntax error, unresolvable plugin), `watchConfig` **throws immediately**. A process cannot start without a valid initial state.
- **Runtime Re-merge (fs.watch fire)**: If an edited file contains a syntax error (`EPARSE`) or validation failure (`EVALIDATE`), morsel **catches the error internally**, logs diagnostics via `onDebug`/`stderr`, and **keeps the previous valid configuration state intact**.

### 2. Directory Deletion & Re-attachment Polling

If a watched folder is deleted (e.g., during a `git checkout` or build clean):

- The directory watcher detects the loss.
- morsel starts an internal lightweight polling timer (`existsSync(dir)` every 1 second).
- Once the directory reappears, morsel automatically re-attaches `fs.watch` and triggers a fresh re-merge.

---

## Clean Shutdown: `store.stop()`

When your application shuts down, gracefully terminate watchers and pending timers:

```typescript
process.on('SIGINT', async () => {
  await store.stop();
  console.log('Store stopped. Active configuration frozen.');
  process.exit(0);
});
```

When `store.stop()` is called:

- Sets `stopped = true` synchronously.
- Clears all active debounce timers.
- Awaits any in-flight re-merge.
- Closes all directory watchers whose reference count reaches zero.
- Freezes `store.config` and `store.layers` at their final known valid state.
- Calling `store.on()` after `stop()` throws an explicit `Error('morsel: store is stopped')`.

---

## Next Steps

- Subscribe to granular property updates with [Key-Level Events](./key-events.md).
- Understand Proxy stability and memory models in [Immuability, Proxy & Mutability](./immutability-memory.md).
