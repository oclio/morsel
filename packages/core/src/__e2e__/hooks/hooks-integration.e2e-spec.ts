import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, watchConfig } from '@/index';

describe('hooks-integration — hooks + other pipeline features', () => {
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

  it('hooks + extends in same pipeline combined correctly', async () => {
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

  it('hooks + validation in same pipeline: hook output merged then validation runs', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      validationPlugins: [validationPlugin],
    } as never);

    expect(config).toEqual({
      app: 'myapp',
      port: 3000,
      validated: true,
    });
  });

  it('signal checked after hook init completes', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      signal: controller.signal,
    });

    expect(initCallCount).toBe(1);
    expect(store.config).toEqual({ hookKey: 'val', port: 3000 });

    await store.stop();
  });
});
