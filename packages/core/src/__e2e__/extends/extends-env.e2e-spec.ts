import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('extends-env — extends + $env interaction', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('per file env: each file applies $env before merge', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      $env: { ci: { port: 8080 } },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      host: 'localhost',
      $env: { ci: { host: '0.0.0.0' } },
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 8080, host: '0.0.0.0' });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });

  it('$env can override extends key itself (resolveEnv called before reading extends)', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      $env: {
        ci: { extends: './base.json' },
      },
      port: 3000,
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });

  it('deep chain with $env at every level (3+ levels)', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'c.json', {
      port: 9000,
      $env: { ci: { port: 9090 } },
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './c.json',
      host: 'localhost',
      $env: { ci: { host: 'b-host' } },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './b.json',
      timeout: 5000,
      $env: { ci: { timeout: 9999 } },
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 9090, host: 'b-host', timeout: 9999 });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
