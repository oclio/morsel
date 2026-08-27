import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import { loadConfig } from '@/index';

describe('extends-stripped — extends key cleanup', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('extends does not appear in final config or layer.config', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('extends');
    }
  });

  it('extends stripped from extends files themselves before merge', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', {
      extends: './deep.json',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'deep.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('extends');
    }
  });

  it('extends and $env as business keys → stripping is unconditional', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 3000,
        $env: { ci: { port: 8080 } },
      });

      const { config, layers } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 8080 });
      expect(config).not.toHaveProperty('$env');
      expect(config).not.toHaveProperty('extends');

      for (const layer of layers) {
        expect(layer.config).not.toHaveProperty('$env');
        expect(layer.config).not.toHaveProperty('extends');
      }
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
