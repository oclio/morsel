import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, loadConfigSync, watchConfig } from '@/index';

describe('hooks-state — stateless, init, dispose', () => {
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

  it('stateless: hook load called at boot and each re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let callCount = 0;
    const hooks = [
      {
        name: 'counter',
        lifecycle: 'before:defaults' as const,
        load: () => {
          callCount++;
          return { call: callCount };
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(callCount).toBe(1);
    expect(store.config).toEqual({ call: 1, port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(callCount).toBe(2);
    expect(store.config).toEqual({ call: 2, port: 8080 });

    await store.stop();
  });

  it('init called once after store creation in watchConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let initCallCount = 0;
    const hooks = [
      {
        name: 'stateful-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        init: () => {
          initCallCount++;
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(initCallCount).toBe(1);

    await store.stop();
  });

  it('init not called in loadConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let initCallCount = 0;
    const hooks = [
      {
        name: 'stateful-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        init: () => {
          initCallCount++;
        },
      },
    ];

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(initCallCount).toBe(0);
  });

  it('init not called in loadConfigSync', () => {
    writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let initCallCount = 0;
    const hooks = [
      {
        name: 'stateful-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        init: () => {
          initCallCount++;
        },
      },
    ];

    loadConfigSync({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(initCallCount).toBe(0);
  });

  it('init async: awaited before store ready', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let wasInitResolved = false;
    const hooks = [
      {
        name: 'async-init-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ hookKey: 'val' }),
        init: () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              wasInitResolved = true;
              resolve();
            }, 50);
          }),
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(wasInitResolved).toBe(true);
    expect(store.config).toEqual({ hookKey: 'val', port: 3000 });

    await store.stop();
  });

  it('init throws → MorselError(EHOOK), watchers released', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'failing-init',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        init: () => {
          throw new Error('init boom');
        },
      },
    ];

    await expect(
      watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        hooks,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EHOOK',
    });
  });

  it('dispose called once on stop()', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let disposeCallCount = 0;
    const hooks = [
      {
        name: 'stateful-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () => {
          disposeCallCount++;
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.stop();

    expect(disposeCallCount).toBe(1);
  });

  it('dispose not called in loadConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let disposeCallCount = 0;
    const hooks = [
      {
        name: 'stateful-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () => {
          disposeCallCount++;
        },
      },
    ];

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(disposeCallCount).toBe(0);
  });

  it('dispose async: awaited during stop', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let isDisposeResolved = false;
    const hooks = [
      {
        name: 'async-dispose-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              isDisposeResolved = true;
              resolve();
            }, 50);
          }),
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.stop();

    expect(isDisposeResolved).toBe(true);
  });

  it('dispose errors caught and logged, do not block stop()', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { contexts, callback } = createDebugCollector();

    const hooks = [
      {
        name: 'failing-dispose',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () => {
          throw new Error('dispose boom');
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      onDebug: callback,
    });

    await store.stop();

    expect(
      contexts.some((context) => context['hookName'] === 'failing-dispose'),
    ).toBe(true);
  });
});
