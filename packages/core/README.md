<div align="center">
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oclio/morsel/main/packages/core/docs/images/morsel_logo_dark.svg">
  <img src="https://raw.githubusercontent.com/oclio/morsel/main/packages/core/docs/images/morsel_logo.svg" alt="Logo" width="90" />
</picture>
  <h1>morsel</h1>
  <p>The only zero-dep config loader that does discovery, hierarchical merge, live-reload, and plugins.</p>
</div>

<br/>

<div align="center">
  <img src="https://img.shields.io/badge/dependencies-0-blue" alt="Zero dependencies" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node.js" />
  <img src="https://img.shields.io/badge/modules-ESM%2FCJS-green" alt="ESM/CJS" />
  <img src="https://img.shields.io/badge/API-async%20%2B%20sync-green" alt="Async/Sync" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://github.com/oclio/morsel/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <img src="https://github.com/oclio/morsel/actions/workflows/release.yml/badge.svg" alt="Release" />
</div>

<br/>

<div align="center">
  <strong>Come for the lean. Stay for the watch.</strong>
</div>

<br/>

<div align="center">
  <img src="https://raw.githubusercontent.com/oclio/morsel/main/packages/core/docs/images/morsel_live.gif" alt="Live demo" width="800" />
</div>

<div align="center">
  <a href="https://oclio.github.io/morsel/">The live demo is here</a>
</div>

## The Problem

Every Node.js config loader forces a trade-off: zero-dep but no watching, or feature-rich but bloated. morsel breaks that compromise.

## What is morsel

- **Lean & Zero-dep:** Config parsing and native file watching packed into less than 9 KB gzipped.
- **Reactive:** `store.on('database.port', callback)` — listen to specific keys using dotted notation, not the entire config object.
- **Live-reload:** `watchConfig` attaches `fs.watch` to directories with per-file debouncing and automatic re-merging. The returned Proxy remains stable—no need to re-fetch the config on updates.
- **Layered Cascade:** `defaults` → `global` (`~/.config/<app>/`) → `project` (`./<app>.config.json`) → `overrides`. Each layer is resolved independently then deep-merged in order.

## Quick Start

### Installation

```bash
pnpm add @oclio/morsel # or npm/yarn
```

### One-shot load

```ts
import { defineConfig, loadConfig } from '@oclio/morsel';

const myApp = defineConfig({
  name: 'myapp',
  defaults: { port: 3000, host: 'localhost' },
});

const { config } = await loadConfig(myApp);
console.log(config.port); // 3000, or overridden by ./myapp.config.json
```

### Live-reload with key-level events

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

### Sync API (for CLI tools)

```ts
import { loadConfigSync } from '@oclio/morsel';
const { config } = loadConfigSync(myApp); // same API, synchronous
```

## Advanced Features

- **Resilient:** If `fs.watch` drops or a config file is deleted mid-watch, morsel self-heals and retains the last valid state instead of crashing your process.
- **Recursive Extends:** Config files can inherit settings via an `extends` property, with built-in cycle detection.
- **Type-safe:** `defineConfig` infers types from your defaults with zero required type assertions.
- **Lifecycle Hooks:** Tap into 8 stages (`before:defaults`, `after:project`, etc.) to inject runtime config and declare custom `watchPaths`.
- **Plugin Architecture:** Extend formats (JSON, YAML, TOML) or post-merge validation through a clean, decoupled plugin API.

📖 **Full documentation at [morsel.oclka.dev](https://morsel.oclka.dev)**

## Contributing

Contributions are welcome! See [`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md) for guidelines and [`CODING_RULES.md`](../../.github/CODING_RULES.md) for coding conventions.

## Support the project

```text
[US-16371]
  As an: independent developer,
  I want: to receive recurring funding,
  So that: I can keep building tools you didn't know you needed.
```

<div align="center">
  <a href="https://github.com/sponsors/oclio"><img src="https://img.shields.io/badge/GitHub-Sponsors-purple?logo=github&logoColor=white" alt="GitHub Sponsors" /></a>
  <a href="https://buymeacoffee.com/oclio"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</div>

## License

[MIT](LICENSE)

<p align="center">
  <img src="https://raw.githubusercontent.com/oclio/morsel/main/docs/images/oclio_logo.svg" alt="oclio logo" width="48" />
</p>

<p align="center">
  <a href="https://oclka.dev">@oclio</a> — TypeScript Engineer<br>
  Lean, pragmatic, test-driven.
</p>
