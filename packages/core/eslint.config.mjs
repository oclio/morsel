import baseConfig from '@config/eslint/base';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...baseConfig,
  {
    // `Promise.withResolvers` requires Node 20.10+ / 22+, but the package
    // declares `engines.node: ">=18"`. The classic `new Promise` pattern
    // keeps the re-merge runner compatible with Node 18.
    files: ['src/store/remerge-runner.ts'],
    rules: {
      'unicorn/prefer-promise-with-resolvers': 'off',
    },
  },
  {
    files: ['src/load/resolve-env.ts'],
    rules: {
      'unicorn/name-replacements': 'off',
    },
  },
  {
    files: ['src/paths/resolve-paths.ts', 'src/store/assert-name.ts'],
    rules: {
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
  {
    files: ['src/store/store-mutator.ts'],
    rules: {
      'unicorn/consistent-boolean-name': 'off',
    },
  },
  // TESTS
  {
    files: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts'],
    rules: {
      'sonarjs/file-permissions': 'off',
      'unicorn/no-return-array-push': 'off',
    },
  },
]);
