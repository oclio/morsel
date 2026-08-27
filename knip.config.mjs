const knipConfig = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignore: ['commitlint.config.mjs', 'packages/core/docs/.vitepress/**'],
  ignoreBinaries: ['gitleaks'],
  ignoreDependencies: ['@commitlint/config-conventional', 'gitleaks'],
  tags: ['-lintignore'],
  workspaces: {
    'packages/test-helpers': {
      ignore: ['src/e2e/setup-test.ts', 'src/shared/runtime.ts'],
    },
  },
};

export default knipConfig;
