---
layout: home

hero:
  name: morsel
  text: Come for the lean. Stay for the watch.
  tagline: The only zero-dep config loader that does discovery, hierarchical merge, live-reload, and plugins.
  image:
    src: /morsel-logo.svg
    alt: morsel logo
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/
    - theme: alt
      text: Reference
      link: /reference/SPEC

features:
  - title: Lean & Zero-dep
    details: JSON parsing and native file watching packed into less than 7 KB gzipped. No transitive dependencies.
  - title: Reactive
    details: store.on('database.port', callback) — listen to specific keys using dotted notation, not the entire config object.
  - title: Live-reload
    details: watchConfig attaches fs.watch to directories with per-file debouncing and automatic re-merging. The returned Proxy remains stable.
  - title: Layered Cascade
    details: defaults → global (~/.config/morsel/) → project (./myapp.config.json) → overrides. Each layer is resolved independently then deep-merged.
  - title: Self-healing & Resilience
    details: If fs.watch drops (Linux/Windows OS limits), it polls existsSync every second to re-attach automatically and catch up.
  - title: ENOENT-safe
    details: If a config file is deleted mid-watch, morsel retains the last valid state instead of crashing your process.
  - title: Recursive Extends
    details: Config files can inherit settings via an extends property. Path resolution relative to parent files, deep-merging, cycle detection.
  - title: Type-safe
    details: Pass your schema or interface — defineConfig infers types from your defaults with zero required type assertions.
  - title: Lifecycle Hooks
    details: Tap into 8 lifecycle stages (before:defaults, after:project, etc.) to inject dynamic runtime config and declare custom watchPaths.
---

## Installation

::: code-group

```bash [pnpm]
pnpm add @oclio/morsel
```

```bash [npm]
npm install @oclio/morsel
```

```bash [yarn]
yarn add @oclio/morsel
```

:::

## One-shot load

```ts
import { defineConfig, loadConfig } from '@oclio/morsel';

const myApp = defineConfig({
  name: 'myapp',
  defaults: { port: 3000, host: 'localhost' },
});

const { config } = await loadConfig(myApp);
console.log(config.port); // 3000, or overridden by ./myapp.config.json
```

## Live-reload with key-level events

```ts
import { defineConfig, watchConfig } from '@oclio/morsel';

const myApp = defineConfig({
  name: 'myapp',
  defaults: { port: 3000, host: 'localhost' },
});

const store = await watchConfig(myApp);

store.on('port', (next, prev) => {
  console.log(`port: ${prev} → ${next}`);
});

// Edit ./myapp.config.json → the event fires automatically

store.stop();
```
