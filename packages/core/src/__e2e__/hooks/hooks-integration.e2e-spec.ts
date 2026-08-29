import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('hooks-integration — hooks + other pipeline features', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('hooks + extends in same pipeline combined correctly', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      base: true,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      project: true,
    });

    const hooks = [
      {
        name: 'hook',
        lifecycle: 'after:project' as const,
        load: () => ({ hookKey: 'val' }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(config).toEqual({
      port: 4000,
      base: true,
      project: true,
      hookKey: 'val',
    });
  });

  it('hooks + extends + $env combined → correct layers and config', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await writeConfig(projectDirectory, 'base.config.json', {
      port: 3000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.config.json',
      $env: {
        development: { host: 'dev.example.com' },
        production: { host: 'prod.example.com' },
      },
    });

    const hooks = [
      {
        name: 'info-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ app: 'myapp' }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      envName: 'development',
    });

    expect(config).toEqual({
      app: 'myapp',
      port: 3000,
      host: 'dev.example.com',
    });

    expect(layers).toHaveLength(5);

    const [
      hookLayer,
      defaultsLayer,
      globalLayer,
      projectLayer,
      overridesLayer,
    ] = layers;

    expect(hookLayer!.source).toBe('hook');
    expect(hookLayer!.hookName).toBe('info-hook');
    expect(hookLayer!.exists).toBe(true);
    expect(hookLayer!.config).toEqual({ app: 'myapp' });

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);
    expect(projectLayer!.config).toEqual({
      port: 3000,
      host: 'dev.example.com',
    });
    expect(projectLayer!.config).not.toHaveProperty('$env');
    expect(projectLayer!.config).not.toHaveProperty('extends');

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });

  it('hooks + validation in same pipeline: hook output merged then validation runs', async () => {
    const hooks = [
      {
        name: 'app-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ app: 'myapp' }),
      },
    ];

    const validationPlugin = {
      name: 'port-validator',
      validate: (config: Record<string, unknown>) => {
        if (typeof config['port'] !== 'number') {
          throw new TypeError('port must be a number');
        }
        return { ...config, validated: true };
      },
    };

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      validationPlugins: [validationPlugin],
    } as never);

    expect(result!.config).toEqual({
      app: 'myapp',
      port: 3000,
      validated: true,
    });
  });

  it('signal checked after hook init completes', async () => {
    const controller = new AbortController();
    let initCallCount = 0;

    const hooks = [
      {
        name: 'signal-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ hookKey: 'val' }),
        init: () => {
          initCallCount++;
        },
      },
    ];

    controller.abort();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      signal: controller.signal,
    } as never);

    expect(initCallCount).toBe(1);
    expect(store!.config).toEqual({ hookKey: 'val', port: 3000 });

    await store!.stop();
  });
});
