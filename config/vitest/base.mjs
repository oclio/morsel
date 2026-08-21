import { defineConfig } from 'vitest/config';
import ignores from '../../ignores.mjs';

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
      exclude: ['dist', 'node_modules'],
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
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
});
