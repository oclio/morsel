import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarJs from 'eslint-plugin-sonarjs';
import tsdoc from 'eslint-plugin-tsdoc';
import turboPlugin from 'eslint-plugin-turbo';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import ignores from '../../ignores.mjs';

const eslintConfig = defineConfig([
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  sonarJs.configs.recommended,
  promise.configs['flat/recommended'],
  unicorn.configs['recommended'],
  prettier,
  globalIgnores(ignores),
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    files: ['**/*.{js,ts,mjs,mts,cjs,cts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      tsdoc,
    },
    rules: {
      'unicorn/prefer-iterator-to-array': 'off',
      'unicorn/no-array-sort': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'tsdoc/syntax': 'error',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      'unicorn/name-replacements': [
        'error',
        {
          replacements: {
            e2e: false,
          },
          allowList: {
            Dev: true,
            Props: true,
            db: true,
            dev: true,
            e2e: true,
            env: true,
            err: true,
            prev: true,
            props: true,
            res: true,
            req: true,
          },
        },
      ],
      '@typescript-eslint/no-extraneous-class': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/todo-tag': 'off',
      'sonarjs/tsdoc-unsupported-tag': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-string-raw': 'off',
    },
  },
  // TESTS
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'tests/**/*'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'promise/param-names': 'off',
      'promise/valid-params': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-undefined': 'off',
    },
  },
  {
    // `__e2e__` directory uses double-underscore (test convention),
    // not kebab-case. Disable filename-case for the whole e2e tree.
    files: ['**/src/__e2e__/**/*'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
  // E2E HELPERS
  {
    files: ['**/src/__e2e__/**/_*.ts'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  // KEYS AUTO-SORT
  {
    files: [
      'cspell.config.mjs',
      'ignores.mjs',
      'knip.config.mjs',
      'test-exclude.mjs',
    ],
    plugins: { perfectionist },
    rules: {
      'perfectionist/sort-objects': [
        'error',
        { type: 'natural', order: 'asc', ignoreCase: true },
      ],
      'perfectionist/sort-arrays': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          useConfigurationIf: { matchesAstSelector: '*' },
        },
      ],
    },
  },
]);

export default eslintConfig;
