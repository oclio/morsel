import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { HookContext } from '@/hooks/types';
import { loadConfig, loadConfigSync, watchConfig } from '@/index';

describe('hooks-lifecycle — layer insertion and ordering', () => {
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

  it('async hook in loadConfig awaited and layer produced', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ asyncKey: 'async-value' }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(config).toEqual({ asyncKey: 'async-value', port: 3000 });
  });

  it('async hook in loadConfigSync throws TypeError', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ key: 'value' }),
      },
    ];

    expect(() =>
      loadConfigSync({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        hooks,
      }),
    ).toThrow(TypeError);
  });

  it('async hook in watchConfig awaited at boot and re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ hookKey: 'hook-value' }),
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 8080 });

    await store.stop();
  });

  it('lifecycle order: 8 hooks, one per lifecycle point, layers in correct order', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'h1',
        lifecycle: 'before:defaults' as const,
        load: () => ({ h1: true }),
      },
      {
        name: 'h2',
        lifecycle: 'after:defaults' as const,
        load: () => ({ h2: true }),
      },
      {
        name: 'h3',
        lifecycle: 'before:global' as const,
        load: () => ({ h3: true }),
      },
      {
        name: 'h4',
        lifecycle: 'after:global' as const,
        load: () => ({ h4: true }),
      },
      {
        name: 'h5',
        lifecycle: 'before:project' as const,
        load: () => ({ h5: true }),
      },
      {
        name: 'h6',
        lifecycle: 'after:project' as const,
        load: () => ({ h6: true }),
      },
      {
        name: 'h7',
        lifecycle: 'before:overrides' as const,
        load: () => ({ h7: true }),
      },
      {
        name: 'h8',
        lifecycle: 'after:overrides' as const,
        load: () => ({ h8: true }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
      overrides: { port: 4000 },
      hooks,
    });

    expect(config).toEqual({
      h1: true,
      h2: true,
      h3: true,
      h4: true,
      h5: true,
      h6: true,
      h7: true,
      h8: true,
      port: 4000,
    });

    const hookLayerNames = layers
      .filter((layer) => layer.source === 'hook')
      .map((layer) => layer.hookName);
    expect(hookLayerNames).toEqual([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'h7',
      'h8',
    ]);
  });

  it('before/after priority: before:project lower, after:project higher', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'before-project',
        lifecycle: 'before:project' as const,
        load: () => ({ port: 1000 }),
      },
      {
        name: 'after-project',
        lifecycle: 'after:project' as const,
        load: () => ({ port: 5000 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(config).toEqual({ port: 5000 });
  });

  it('multiple same lifecycle: hooks executed in array order', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'first',
        lifecycle: 'before:defaults' as const,
        load: () => ({ a: 1 }),
      },
      {
        name: 'second',
        lifecycle: 'before:defaults' as const,
        load: () => ({ b: 2 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(config).toEqual({ a: 1, b: 2, port: 3000 });
  });

  it('empty record: hook returning {} produces empty layer, no effect on config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'empty',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
      hooks,
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('override existing key: before:defaults has lower priority than defaults', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const hooks = [
      {
        name: 'override-attempt',
        lifecycle: 'before:defaults' as const,
        load: () => ({ port: 9999 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
      hooks,
    } as never);

    expect(config).toEqual({ port: 3000, host: 'localhost' });
  });

  it('layer source: hook layer has source=hook and hookName set', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'my-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ hookKey: 'val' }),
      },
    ];

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.hookName).toBe('my-hook');
    expect(hookLayer!.config).toEqual({ hookKey: 'val' });
  });

  it('load receives HookContext with cwd and envName', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let receivedCwd: string | undefined;
    let receivedEnvironmentName: string | undefined;

    const hooks = [
      {
        name: 'context-hook',
        lifecycle: 'before:defaults' as const,
        load: (context: HookContext) => {
          receivedCwd = context.cwd;
          receivedEnvironmentName = context.envName;
          return {};
        },
      },
    ];

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      hooks,
    });

    expect(receivedCwd).toBe(projectDirectory);
    expect(receivedEnvironmentName).toBe('ci');
  });

  it('HookContext.cwd and envName correct with defaults', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    let receivedEnvironmentName: string | undefined;

    try {
      const hooks = [
        {
          name: 'context-hook',
          lifecycle: 'before:defaults' as const,
          load: (context: HookContext) => {
            receivedEnvironmentName = context.envName;
            return {};
          },
        },
      ];

      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        hooks,
      });

      expect(receivedEnvironmentName).toBe('production');
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
