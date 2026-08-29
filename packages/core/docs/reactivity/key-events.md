# Key-Level Events & Two-Phase Ordering

Most configuration loaders only provide coarse-grained "something changed" events, forcing you to manually compare large objects to see what was modified.

morsel calculates a recursive diff between the old and new configuration states and emits **surgical, key-level events using dotted notation**.

---

## Subscribing to Changes: `store.on`

Use `store.on(keyPath, listener)` to listen for changes on any property:

```typescript
import { createReactiveStore } from '@oclio/morsel';

const store = await createReactiveStore({
  name: 'myapp',
  defaults: {
    port: 3000,
    database: {
      host: 'localhost',
      pool: { min: 2, max: 10 },
    },
    features: ['auth', 'billing'],
  },
});

// 1. Root scalar changed
store.on('port', (next, prev) => {
  console.log(`Port changed: ${prev} → ${next}`);
});

// 2. Deeply nested property changed
store.on('database.pool.max', (next, prev) => {
  console.log(`Max DB pool adjusted: ${prev} → ${next}`);
});

// 3. Unsubscribe when no longer needed
const unsubscribe = store.on('database.host', (next) => {
  console.log(`New DB host: ${next}`);
});
unsubscribe();
```

---

## Mutation Categories & Callback Signatures

| Mutation Type                   | Callback `(next, prev)`   | Description                                               |
| :------------------------------ | :------------------------ | :-------------------------------------------------------- |
| **Scalar Modified**             | `(nextValue, oldValue)`   | The scalar at this dotted path changed value.             |
| **Scalar Added**                | `(nextValue, undefined)`  | A new scalar property was introduced.                     |
| **Scalar Removed**              | `(undefined, oldValue)`   | A scalar property was deleted.                            |
| **Object Replaced with Scalar** | `(nextScalar, oldObject)` | The node type changed. Child scalars also emit deletions. |
| **Scalar Replaced with Object** | `(newObject, prevScalar)` | The node type changed. Child scalars also emit additions. |
| **Array Modified**              | `(newArray, oldArray)`    | Arrays are compared as atomic units (no index notation).  |

---

## The Two-Phase Ordering Invariant

When complex structural transformations happen (e.g. an object is deleted or converted to a scalar), listeners could crash with `TypeError: Cannot read property of undefined` if notifications fired in arbitrary order.

To guarantee state consistency, morsel strictly enforces **Two-Phase Ordering**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Deletions (Bottom-Up)                                         │
│ Child properties are notified of deletion BEFORE their parent changes. │
│ Order: Deepest keys first, descending alphabetical order at same depth.│
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Additions & Modifications (Top-Down)                          │
│ Parent properties update BEFORE their child properties fire.           │
│ Order: Shallowest keys first, ascending alphabetical order at same depth│
└────────────────────────────────────────────────────────────────────────┘
```

### Concrete Example: Object Replacement

Suppose your config changes from:

```json
{ "server": { "ssl": { "enabled": true, "cert": "cert.pem" } } }
```

to:

```json
{ "server": "disabled" }
```

Execution order:

1. `server.ssl.enabled` fires `(undefined, true)` (Phase 1: deletion)
2. `server.ssl.cert` fires `(undefined, "cert.pem")` (Phase 1: deletion)
3. `server.ssl` fires `(undefined, { enabled: true, cert: "cert.pem" })` (Phase 1: deletion)
4. `server` fires `("disabled", { ssl: ... })` (Phase 2: modification)

Because child deletion callbacks run before the parent is replaced with a string, any listener checking `store.config.server.ssl` will never encounter an invalid intermediate state.

---

## No Wildcards: Listen to the Parent Node

morsel **does not support wildcard syntax** (like `store.on('database.*', cb)`).

If you want to observe all mutations across an entire subtree, simply subscribe directly to the parent property:

```typescript
store.on('database', (nextDb, prevDb) => {
  console.log('Database configuration updated:', nextDb);
});
```

---

## Next Steps

- Understand how data is stored and referenced in [Immutability, Proxy & Mutability](./immutability-memory.md).
- Hook into the pipeline with [Lifecycle Hooks](../extensibility/lifecycle-hooks.md).
