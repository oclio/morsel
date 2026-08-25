import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { Hook } from '@/index';
import { loadConfig, loadConfigSync } from '@/index';

describe('cascade-reserved-keys — reserved keys stripped', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('extends and $env stripped from file layers, defaults, and overrides', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
      extends: './base.json',
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config, layers } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        defaults: { port: 4000, extends: './defaults-base.json' },
        overrides: { debug: true, extends: './overrides-base.json' },
      });

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

  it('strips extends and ignores $env when envName does not match (async)', async () => {
    const hooks: readonly Hook[] = [
      {
        name: 'reserved-hook',
        lifecycle: 'before:defaults',
        load: () => ({
          app: 'myapp',
          extends: './should-be-stripped.json',
          $env: {
            production: { fromEnv: true },
          },
        }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: `${projectDirectory}`,
      globalDir: globalDirectory,
      hooks,
      envName: 'development',
    });

    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('fromEnv');
    expect(config['app']).toBe('myapp');

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('extends');
    expect(hookLayer!.config).not.toHaveProperty('$env');
    expect(hookLayer!.config).not.toHaveProperty('fromEnv');
    expect(hookLayer!.config['app']).toBe('myapp');
  });

  it('strips extends and ignores $env when envName does not match (sync)', () => {
    const syncDirectory = mkdtempSync(path.join(tmpdir(), 'morsel-e2e-'));

    const hooks: readonly Hook[] = [
      {
        name: 'reserved-hook-sync',
        lifecycle: 'before:defaults',
        load: () => ({
          app: 'myapp-sync',
          extends: './should-be-stripped.json',
          $env: {
            production: { fromEnv: true },
          },
        }),
      },
    ];

    const { config, layers } = loadConfigSync({
      name: 'myapp',
      cwd: syncDirectory,
      hooks,
      envName: 'test',
    });

    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('fromEnv');
    expect(config['app']).toBe('myapp-sync');

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('extends');
    expect(hookLayer!.config).not.toHaveProperty('$env');
  });

  it('resolves $env from hook output when envName matches', async () => {
    const hooks: readonly Hook[] = [
      {
        name: 'env-hook',
        lifecycle: 'before:defaults',
        load: () => ({
          base: 'value',
          $env: {
            production: { overridden: true },
          },
        }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      envName: 'production',
    });

    expect(config).not.toHaveProperty('$env');
    expect(config).toEqual({ base: 'value', overridden: true });

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('$env');
    expect(hookLayer!.config).toEqual({ base: 'value', overridden: true });
  });

  it('$env stripped from all 4 layers simultaneously', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 8080,
      $env: { production: { port: 9090 } },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: { production: { port: 9090 } },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000, $env: { production: { port: 9090 } } },
      overrides: { debug: true, $env: { production: { port: 9090 } } },
      envName: 'production',
    });

    expect(config).not.toHaveProperty('$env');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
    }
  });

  it('extends stripped from all 4 layers simultaneously', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 8080,
      extends: './global-base.json',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      extends: './project-base.json',
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000, extends: './defaults-base.json' },
      overrides: { debug: true, extends: './overrides-base.json' },
    });

    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('extends');
    }
  });

  it('extends and $env cannot be used as business keys in final config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: { ci: { port: 8080 } },
      extends: './base.json',
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 8080 });
      expect(config).not.toHaveProperty('$env');
      expect(config).not.toHaveProperty('extends');
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
