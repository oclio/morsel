import { defineConfig } from 'vitest/config';

import ignores from '../../ignores.mjs';
import testExclude from '../../test-exclude.mjs';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: ignores,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: false,
      include: ['src/**/*.ts'],
      exclude: [...ignores, ...testExclude],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          testTimeout: 10_000,
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          testTimeout: 30_000,
          include: ['src/**/*.e2e-spec.ts'],
          setupFiles: ['src/__e2e__/_setup.ts'],
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
});
