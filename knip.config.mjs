const knipConfig = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignore: [
    'commitlint.config.mjs',
    'packages/core/docs/.vitepress/**',
    'packages/e2e-helpers/src/runtime.ts',
    'packages/e2e-helpers/src/setup-test.ts',
  ],
  ignoreBinaries: ['gitleaks'],
  ignoreDependencies: ['@commitlint/config-conventional', 'gitleaks'],
  tags: ['-lintignore'],
  workspaces: {
    'packages/plugin-accessors': {
      ignoreDependencies: ['@oclio/morsel-e2e-helpers'],
    },
  },
};

export default knipConfig;
