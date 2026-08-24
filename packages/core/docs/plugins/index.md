# Plugins

> morsel is pluggable by design. The plugin ecosystem is growing — here's what's available and what's coming.

## Format

Format plugins extend morsel with new file format parsers.

| Package               | Extensions            | Status          |
| --------------------- | --------------------- | --------------- |
| `jsonPlugin`          | `.json`               | **Built-in**    |
| `@oclio/morsel-json5` | `.json5`              | 📋 October 2026 |
| `@oclio/morsel-yaml`  | `.yaml`, `.yml`       | 📋 October 2026 |
| `@oclio/morsel-toml`  | `.toml`               | 📋 October 2026 |
| `@oclio/morsel-ini`   | `.ini`                | 📋 October 2026 |
| `@oclio/morsel-ts`    | `.ts`, `.mts`         | 📋 October 2026 |
| `@oclio/morsel-js`    | `.js`, `.mjs`, `.cjs` | 📋 October 2026 |

## Validation

Validation plugins validate and transform the merged configuration post-merge.

| Package                 | Wrapper           | Status          |
| ----------------------- | ----------------- | --------------- |
| `@oclio/morsel-zod`     | zod               | 📋 October 2026 |
| `@oclio/morsel-ajv`     | ajv (JSON Schema) | 📋 October 2026 |
| `@oclio/morsel-yup`     | yup               | 📋 October 2026 |
| `@oclio/morsel-valibot` | valibot           | 📋 October 2026 |
| `@oclio/morsel-schema`  | JSON schema (0D)  | 📋 October 2026 |
| `@oclio/morsel-env`     | env validation    | 📋 October 2026 |

## Store Extensions

| Package                  | Role                     | Status          |
| ------------------------ | ------------------------ | --------------- |
| `@oclio/morsel-wildcard` | wildcard event listeners | 📋 October 2026 |

## Hooks

Hooks inject dynamic configuration at 8 lifecycle points in the pipeline.

| Package               | Role                    | Status          |
| --------------------- | ----------------------- | --------------- |
| `@oclio/morsel-env`   | process.env / .env file | 📋 October 2026 |
| `@oclio/morsel-vault` | HashiCorp Vault secrets | 📋 October 2026 |

---

## Authoring Plugins

Want to build your own plugin? See the [Authoring Plugins guide](../extensibility/authoring-plugins) for the full `FormatPlugin`, `ValidationPlugin`, and `LayerHook` contracts.
