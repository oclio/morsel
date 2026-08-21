import { defineConfig } from 'eslint/config';

import baseConfig from './config/eslint/base.mjs';

export default defineConfig([
  ...baseConfig,
  {
    // `Promise.withResolvers` requires Node 20.10+ / 22+, but the package
    // declares `engines.node: ">=18"`. The classic `new Promise` pattern
    // keeps the re-merge runner compatible with Node 18.
    files: ['packages/core/src/store/remerge-runner.ts'],
    rules: {
      'unicorn/prefer-promise-with-resolvers': 'off',
    },
  },
  {
    files: ['packages/core/src/load/resolve-env.ts'],
    rules: {
      'unicorn/name-replacements': 'off',
    },
  },
  {
    files: [
      'packages/core/src/paths/resolve-paths.ts',
      'packages/core/src/store/assert-name.ts',
    ],
    rules: {
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
]);
