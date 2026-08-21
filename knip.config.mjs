const knipConfig = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignore: [
    'commitlint.config.mjs',
    'packages/*/src/**/*.spec.ts',
  ],
  ignoreBinaries: ['gitleaks'],
  ignoreDependencies: ['@commitlint/config-conventional', 'gitleaks'],
  tags: ['-lintignore'],
  workspaces: {},
};

export default knipConfig;
