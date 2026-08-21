# Coding Rules

> No pain, no gain.
> — Arnold Schwarzenegger

## Prerequisites & General Conventions

- **Read the ESLint config** : before contributing, review `eslint.config.mjs`. All enabled rules (TypeScript strict, `unicorn`, `sonarjs`, `promise`, `tsdoc`) are non-negotiable — they define the quality contract of the project.
- **Runtime compatibility** : the code must run on Node, Bun, and Deno. Do not use Node-only APIs without a runtime guard. Prefer cross-runtime abstractions.
- **Mandatory checks before push** : `pnpm check:all` must pass without errors (types, lint, tests, coverage, knip, spell, markdown, secrets, build, size, publint).

## Comments & Documentation

- **English only** : all comments, JSDoc, commit messages and PRs must be in English.
- **Zero superfluous comments** :
  - No comment that describes what the code already does explicitly (`// increment i` above `i++`).
  - No "doesn't work", "TODO fix", "hack" comments without context — a comment must explain the **why**, not the **what**.
  - No comment explaining that a test exists to kill a specific mutant.
- **JSDoc on public API only** : exported functions and types must have concise JSDoc. Internal code does not need JSDoc — clear names suffice.

## Modularity & Testability Rules

- **Executable code budget** : ~150 lines hard limit (excluding imports, type/interface declarations, JSDoc, and block comments). Beyond 160, split into specialized sub-modules along a clear structural boundary (see SRP — business vs infrastructure). Total file size (imports, types, JSDoc) is irrelevant — only executable code counts.
- **Single Responsibility Principle (SRP)** :
  - A module should have only one reason to change.
  - Separate business logic from infrastructure: a module that enforces domain rules must not also handle I/O, concurrency, serialization, or retry concerns. If a module mixes both layers, split it — the business module delegates to infrastructure collaborators.
  - The split criterion is structural (business vs infrastructure), not quantitative (line count or mock count). A small orchestration module with many collaborators is fine; a module that mixes domain rules with fs/network/concurrency is not.
- **Cyclomatic Complexity** :
  - Limit nesting of control structures (`if`, `for`, `try/catch`) to **3 levels of depth maximum**.
- **Named exports only** : `export default` is forbidden. All exports must be named.
- **No parameter mutation** : a function must never modify its arguments. Return a new value instead.
- **Pure business logic** : domain rules must be pure functions — no side effects, no I/O. Side effects belong at the boundaries (infrastructure layer, see SRP).

## Programming Style

### 🚫 No `any` Type

- **Zero `any` in source files (Explicit or Implicit)** :
  - The `any` keyword is strictly forbidden in source files.
- **Systematic replacement with `unknown`** :
  - All external, unconstrained generic, or dynamic data must be typed as `unknown`.
  - Type narrowing must be performed explicitly via Type Guards (`isRecord`, `isString`, etc.) before manipulation.
- **Allowed exceptions (Extreme Edge Cases)** :
  - A cast via `any` (`as any`) is tolerated in test files to simulate corrupted objects. The `@typescript-eslint/no-explicit-any` rule is disabled for test files — no inline disable comment is needed.

### 🪢 Async Control Flow

- **No `.then` / `.catch` / `.finally`** : promise chaining is **strictly forbidden** in both source and test files. Use `await` for resolution and `try/catch` (or `try/catch/finally`) for error handling. This applies to all promise consumers — including fire-and-forget patterns where a `.then()` callback is used only for side effects.
- **Fire-and-forget** : when a promise must run without awaiting (e.g. spawning a background task), use `void promise` — never `.then()` to attach a side effect. If a side effect is needed on resolution, refactor to `await` inside an `async` IIFE or extract a named `async` helper.

### 🛡️ Defensive Programming & Testability (Mutation-Friendly)

- **Error handling convention** :
  - Invariant violations (impossible internal state) are **thrown** via `assert(condition, message)` — never returned.
- **Boundary Validation Principle** :
  - Defensive validation (types, `null`/`undefined`, formats) is **exclusively reserved for public / API entry-point functions**.
  - Internal / private code must trust TypeScript type contracts and invariants established upstream.
- **No Ghost Guards** :
  - Adding safety `if` statements or `|| defaultValue` fallbacks on variables whose type/flow already guarantees presence is forbidden.
  - A guard that can never be false at runtime is a ghost guard — remove it.
  - A guard that protects against a real (if rare) runtime state is a legitimate safety net — keep it, but it must be covered by a test. Untested safety nets will produce surviving mutants.
- **Handling Impossible Cases** :
  - Do not mask an inconsistent state with a silent `return` or `continue`.
  - For "impossible" internal invariants, use a minimal `assert(condition, message)` helper rather than `if` blocks with silent `return`s.
  - If the type structure makes the branch obsolete, remove it entirely.
- **Mutation Testing Goal (Stryker)** :
  - Every `if/else` branch must correspond to a real business rule or a real testable operational error case.

### 🚫 No Tool Suppression in Source Files

- **No ESLint disables in sources** : `// eslint-disable-next-line` and block-level `/* eslint-disable */` are **strictly forbidden** in `src/` files. If a lint rule fires, fix the code — do not silence the rule locally.
- **No ESLint disables in tests** : the same prohibition applies to test files (`*.spec.ts`, `*.test.ts`, `*.e2e-spec.ts`, `__tests__/**`). `// eslint-disable-next-line` and block-level `/* eslint-disable */` are **strictly forbidden** in tests. If a lint rule fires in a test, fix the test — do not silence the rule locally.
- **No Stryker disables in sources** : `// Stryker disable` and `// Stryker disable next-line` comments are **strictly forbidden** in `src/` files. Excluding files or mutation types in `stryker.config.mjs` requires a documented justification in the config file itself.

### 🧬 Mutation Testing (Stryker)

- **No Surviving Mutants** : a surviving mutant is a missing test or a ghost guard (see §"No Ghost Guards").

### 📐 TypeScript Configuration

- **Do not modify `tsconfig.json`** : the strict flags (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`) are project invariants. If the compiler errors, fix the code — do not relax the config.

### 📛 Naming Conventions

- **Files** : `kebab-case` mandatory.
- **Path aliases** : the `@/` alias is **mandatory** in all source and test modules (e.g. `import { assert } from '@/core/assert'`). Relative imports (`./`, `../`) are forbidden except in config files and barrel re-exports.
- **No barrel imports from modules** : modules must import from their concrete source path (e.g. `@/core/assert`), never from a barrel (`@/core/index` or `@/core`). Importing from a barrel creates an implicit dependency on the entire re-export graph and can introduce circular dependencies.

### 📝 Conventional Commits

- **Use `pnpm commit`** : launches Commitizen for a guided message. `commitlint` enforces the format — do not bypass with `--no-verify`.

### 🧪 Test Structure

- **Framework** : Vitest with `globals: true` — do not import `describe`, `it`, `expect`, `vi`, etc. They are available globally.
- **Colocation** : unit tests live in a `__tests__/` folder next to the module: `src/core/__tests__/result.spec.ts`. E2E tests: `src/**/__e2e__/*.e2e-spec.ts`.
- **AAA Pattern** : each test follows Arrange → Act → Assert. Separate the three phases with a blank line — no comments (`// --- Act` is forbidden). Code must be readable without annotations.
- **Grouping by logic** : group tests by behavior or use case with a `describe` per function. Nested `describe` blocks if the function has multiple distinct behaviors.
- **Prioritize `.each`** : use `it.each` whenever there are ≥ 2 similar cases with different inputs/outputs. No manual test duplication when a table of cases suffices.
- **Mocks** : mock all imported dependencies. Do not mock the module under test.

### 🔄 Dual ESM/CJS

- **`sideEffects: false`** : the package is marked as side-effect-free — do not introduce top-level code with side effects.
