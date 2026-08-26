import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-stripped — extends key cleanup', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('extends does not appear in final config or layer.config', async () => {
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
