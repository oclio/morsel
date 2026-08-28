import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  withEnvironmentVariable,
  writeConfig,
} from '@oclio/test-helpers';

import type { HookContext } from '@/hooks/types';
import { loadConfigSync } from '@/index';

describe('hooks-lifecycle — layer insertion and ordering', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('async hook in loadConfig awaited and layer produced', async () => {
    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ asyncKey: 'async-value' }),
      },
    ];

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({ asyncKey: 'async-value', port: 3000 });
  });

  it('async hook in loadConfigSync throws TypeError', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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

  it('async hook in createReactiveStore awaited at boot and re-merge', async () => {
    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ hookKey: 'hook-value' }),
      },
    ];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(store!.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await assertRemerge(store!, { hookKey: 'hook-value', port: 8080 });

    await store!.stop();
  });

  it('lifecycle order: 8 hooks, one per lifecycle point, layers in correct order', async () => {
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

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      defaults: { port: 3000 },
      overrides: { port: 4000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({
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

    const hookLayerNames = result!.layers
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

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({ port: 5000 });
  });

  it('multiple same lifecycle: hooks executed in array order', async () => {
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

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({ a: 1, b: 2, port: 3000 });
  });

  it('empty record: hook returning {} produces empty layer, no effect on config', async () => {
    const hooks = [
      {
        name: 'empty',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
      },
    ];

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      defaults: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('override existing key: before:defaults has lower priority than defaults', async () => {
    const hooks = [
      {
        name: 'override-attempt',
        lifecycle: 'before:defaults' as const,
        load: () => ({ port: 9999 }),
      },
    ];

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { host: 'localhost' },
      defaults: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(result!.config).toEqual({ port: 3000, host: 'localhost' });
  });

  it('layer source: hook layer has source=hook and hookName set', async () => {
    const hooks = [
      {
        name: 'my-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ hookKey: 'val' }),
      },
    ];

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    const hookLayer = result!.layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.hookName).toBe('my-hook');
    expect(hookLayer!.config).toEqual({ hookKey: 'val' });
  });

  it('load receives HookContext with cwd and envName', async () => {
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

    const { projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      envName: 'ci',
      createGlobalDir: true,
      hooks,
    } as never);

    expect(receivedCwd).toBe(projectDirectory);
    expect(receivedEnvironmentName).toBe('ci');
  });

  it('HookContext.cwd and envName correct with defaults', async () => {
    let receivedEnvironmentName: string | undefined;

    await withEnvironmentVariable('NODE_ENV', 'production', async () => {
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

      await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        hooks,
      } as never);

      expect(receivedEnvironmentName).toBe('production');
    });
  });
});
