<div align="center">
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/images/morsel_logo_dark.svg">
  <img src="./docs/images/morsel_logo.svg" alt="Logo" width="90" />
</picture>
  <h1>morsel</h1>
  <p>The only zero-dep config loader that does discovery, hierarchical merge, live-reload, and plugins.</p>
</div>

<br/>

<div align="center">
  <img src="https://img.shields.io/badge/zero--dep-core-blue" alt="Zero dependencies (core)" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node.js" />
  <img src="https://img.shields.io/badge/modules-ESM%2FCJS-green" alt="ESM/CJS" />
  <img src="https://img.shields.io/badge/API-async%20%2B%20sync-green" alt="Async/Sync" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://github.com/oclio/morsel/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <img src="https://github.com/oclio/morsel/actions/workflows/release.yml/badge.svg" alt="Release" />
</div>

<br/>

📖 **Full documentation at [morsel.oclka.dev](https://morsel.oclka.dev)**

## Packages

| Package                                        | Description                                            | Status        |
| ---------------------------------------------- | ------------------------------------------------------ | ------------- |
| **Core**                                       |                                                        |               |
| [`@oclio/morsel`](packages/core)               | Config loader: discovery, merge, live-reload, plugins  | 🔓 Unreleased |
| **Format Plugins**                             |                                                        |               |
| `jsonPlugin`                                   | `.json`                                                | ✅ Built-in   |
| `@oclio/morsel-json5`                          | `.json5`                                               | 📋 Planned    |
| `@oclio/morsel-yaml`                           | `.yaml`, `.yml`                                        | 📋 Planned    |
| `@oclio/morsel-toml`                           | `.toml`                                                | 📋 Planned    |
| `@oclio/morsel-ini`                            | `.ini`                                                 | 📋 Planned    |
| `@oclio/morsel-ts`                             | `.ts`, `.mts`                                          | 📋 Planned    |
| `@oclio/morsel-js`                             | `.js`, `.mjs`, `.cjs`                                  | 📋 Planned    |
| **Validation**                                 |                                                        |               |
| `@oclio/morsel-zod`                            | zod                                                    | 📋 Planned    |
| `@oclio/morsel-ajv`                            | ajv                                                    | 📋 Planned    |
| `@oclio/morsel-yup`                            | yup                                                    | 📋 Planned    |
| `@oclio/morsel-valibot`                        | valibot                                                | 📋 Planned    |
| `@oclio/morsel-schema`                         | JSON schema                                            | 📋 Planned    |
| `@oclio/morsel-env`                            | env validation                                         | 📋 Planned    |
| **Ecosystem**                                  |                                                        |               |
| `@oclio/morsel-multi`                          | load and manage multiple named configs in one instance | 📋 Planned    |
| **Tooling**                                    |                                                        |               |
| `@oclio/morsel-cli`                            | command-line tool for config inspection and management | 📋 Planned    |
| `morsel/action`                                | GitHub Action for config validation in CI pipelines    | 📋 Planned    |
| **Internal**                                   |                                                        |               |
| [`@oclio/test-helpers`](packages/test-helpers) | Unit & E2E test helpers                                | ✅ Internal   |

## Contributing

Contributions are welcome! See [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) for guidelines and [`CODING_RULES.md`](.github/CODING_RULES.md) for coding conventions.

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
  <img src="docs/images/oclio_logo.svg" alt="oclio logo" width="48" />
</p>

<p align="center">
  <a href="https://oclka.dev">@oclio</a> — TypeScript Engineer<br>
  Lean, pragmatic, test-driven.
</p>
