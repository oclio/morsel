# Contributing Guidelines

First off, thank you for considering contributing to `@oclio` projects! It's contributions like yours that make the developer community such an amazing place to learn, inspire, and create.

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](../CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check existing issues to see if the problem has already been reported.

When creating a bug report, please use our **Bug Report Template** and include:

- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected vs. actual behavior.
- Environment details (Node version, OS, package versions).

> ⚠️ **Security Vulnerabilities:** Please do **NOT** open public issues for security vulnerabilities. Email [security@oclka.dev](mailto:security@oclka.dev) instead. See [SECURITY.md](../SECURITY.md) for details.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When suggesting an enhancement:

- Use the **Feature Request Template**.
- Provide a clear description of the feature and its value.
- Outline proposed solutions or alternatives considered.

### Submitting Pull Requests

1. **Fork the repo** and create your branch from `main`:

   ```bash
   git checkout -b feat/my-awesome-feature
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Make your changes** and ensure code quality:

   ```bash
   pnpm check:all
   ```

4. **Follow Conventional Commits**:
   - `feat: add new CLI flag`
   - `fix: resolve path formatting issue`
   - `docs: update command reference`
5. **Add a changeset** (if making a user-facing change):

   ```bash
   pnpm changeset
   ```

6. **Push to your fork** and submit a Pull Request targeting `main`.

---

## Development Standards

- **TypeScript**: Strict type-checking enabled. No implicit `any`.
- **Code Style**: Enforced automatically via ESLint / Prettier. Run `pnpm check:all` before pushing.
- **Tests**: Include unit tests for new features or bug fixes whenever applicable.
- **Coding Rules**: See [`CODING_RULES.md`](CODING_RULES.md) for the full coding conventions (modularity, defensive programming, mutation testing, naming, test structure, etc.).

---

## Community & Support

Have questions or need help?

- Open a discussion in the **GitHub Discussions** tab.
- For general inquiries, contact [hello@oclka.dev](mailto:hello@oclka.dev).
- For bug discussions, email [bugs@oclka.dev](mailto:bugs@oclka.dev).
- For security concerns, email [security@oclka.dev](mailto:security@oclka.dev).

Thank you for building with `@oclio`! 🚀
