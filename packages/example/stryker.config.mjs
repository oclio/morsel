// @ts-expect-error - Stryker config type not available at lint time

import ignores from '../../ignores.mjs';
import testExclude from '../../test-exclude.mjs';

// Derive directory-level ignore patterns from glob patterns ending with /**
const sharedIgnorePatterns = ignores
  .filter((p) => p.endsWith('/**'))
  .map((p) => `/${p.replace('/**', '')}`);

const config = {
  testRunner: 'vitest',
  reporters: ['html', 'clear-text', 'progress', 'dashboard', 'json'],
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],
  timeoutMS: 240_000,
  timeoutFactor: 3,
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',
  concurrency: 4,
  mutate: ['src/**/*.ts', ...testExclude.map((pattern) => `!${pattern}`)],
  ignorePatterns: [...sharedIgnorePatterns, 'src/__e2e__/**', 'tests/**'],
  thresholds: {
    high: 95,
    low: 80,
    break: 65,
  },
  vitest: {
    configFile: 'vitest.config.mjs',
  },
};

export default config;
