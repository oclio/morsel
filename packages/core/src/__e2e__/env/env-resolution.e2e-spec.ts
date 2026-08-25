import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { Hook } from '@/index';
import { loadConfig } from '@/index';

describe('env-resolution — $env resolution per layer', () => {
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

  it('overrides keys from $env block matching envName', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
      timeout: 5000,
      $env: {
        ci: { port: 8080, host: '0.0.0.0' },
      },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080, host: '0.0.0.0', timeout: 5000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer!.config).not.toHaveProperty('$env');
    expect(projectLayer!.config).not.toHaveProperty('extends');
  });

  it('$env.ci nested object merges with file body, not replaces', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: true, prettier: true },
      server: { db: { host: 'localhost', port: 5432 } },
      $env: {
        ci: {
          tools: { eslint: false },
          server: { db: { port: 9999 } },
        },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({
      tools: { eslint: false, prettier: true },
      server: { db: { host: 'localhost', port: 9999 } },
    });
  });

  it('nested $env within $env block is not applied recursively', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: {
          port: 8080,
          $env: {
            prod: { port: 9999 },
          },
        },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080 });
    expect(config).not.toHaveProperty('$env');
  });

  it('each file in extends chain applies its own $env before merge', async () => {
    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      host: '0.0.0.0',
      $env: {
        ci: { port: 8080 },
      },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      host: 'localhost',
      $env: {
        ci: { host: '127.0.0.1' },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080, host: '127.0.0.1' });
  });

  it('$env in global file resolved during global layer cleanup', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 4000,
      $env: {
        ci: { port: 8080 },
      },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080 });

    const globalLayer = layers.find((layer) => layer.source === 'global');
    expect(globalLayer!.config).not.toHaveProperty('$env');
  });

  it('defaults and overrides apply $env but do not follow extends', async () => {
    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      defaults: {
        port: 4000,
        $env: { ci: { port: 8080 } },
        extends: './defaults-base.json',
      },
      overrides: {
        host: 'localhost',
        $env: { ci: { host: '0.0.0.0' } },
        extends: './overrides-base.json',
      },
    });

    expect(config).toEqual({ port: 8080, host: '0.0.0.0' });

    const defaultsLayer = layers.find((layer) => layer.source === 'defaults');
    const overridesLayer = layers.find((layer) => layer.source === 'overrides');

    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');

    expect(overridesLayer!.config).not.toHaveProperty('$env');
    expect(overridesLayer!.config).not.toHaveProperty('extends');
  });

  it('$env in all 4 layers resolved independently', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 4000,
      $env: { ci: { port: 8080 } },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: { ci: { port: 9000 } },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      defaults: { port: 5000, $env: { ci: { port: 7000 } } },
      overrides: { port: 6000, $env: { ci: { port: 9999 } } },
    });

    expect(config).toEqual({ port: 9999 });

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
    }
  });

  it('$env in hook output resolved according to envName', async () => {
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

  it('$env in hook with envName undefined emits warning, $env ignored', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];

    try {
      const debugMessages: string[] = [];

      const hooks: readonly Hook[] = [
        {
          name: 'env-hook-undefined',
          lifecycle: 'before:defaults',
          load: () => ({
            base: 'value',
            $env: {
              production: { overridden: true },
            },
          }),
        },
      ];

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        hooks,
        onDebug: (message: string) => {
          debugMessages.push(message);
        },
      });

      expect(config).toEqual({ base: 'value' });
      expect(config).not.toHaveProperty('overridden');
      expect(debugMessages.some((message) => message.includes('$env'))).toBe(
        true,
      );
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
