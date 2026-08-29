import {
  assertRemerge,
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfigSync } from '@/index';

describe('hooks-state — stateless, init, dispose', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('stateless: hook load called at boot and each re-merge', async () => {
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

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(callCount).toBe(1);
    expect(store!.config).toEqual({ call: 1, port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await assertRemerge(store!, { call: 2, port: 8080 });

    expect(callCount).toBe(2);

    await store!.stop();
  });

  it('init called once after store creation in createReactiveStore', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(initCallCount).toBe(1);

    await store!.stop();
  });

  it('init not called in loadConfig', async () => {
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

    await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(initCallCount).toBe(0);
  });

  it('init not called in loadConfigSync', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(wasInitResolved).toBe(true);
    expect(store!.config).toEqual({ hookKey: 'val', port: 3000 });

    await store!.stop();
  });

  it('init throws → MorselError(EHOOK), watchers released', async () => {
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
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        hooks,
      } as never),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EHOOK',
    });
  });

  it('dispose called once on stop()', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    await store!.stop();

    expect(disposeCallCount).toBe(1);
  });

  it('dispose not called in loadConfig', async () => {
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

    await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(disposeCallCount).toBe(0);
  });

  it('dispose async: awaited during stop', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    await store!.stop();

    expect(isDisposeResolved).toBe(true);
  });

  it('dispose errors caught and logged, do not block stop()', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      onDebug: callback,
    } as never);

    await store!.stop();

    expect(
      contexts.some((context) => context['hookName'] === 'failing-dispose'),
    ).toBe(true);
  });
});
