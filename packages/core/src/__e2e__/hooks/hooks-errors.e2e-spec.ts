import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfigSync } from '@/index';

describe('hooks-errors — hook errors', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('throw at boot → MorselError(EHOOK)', async () => {
    const hooks = [
      {
        name: 'boom',
        lifecycle: 'before:defaults' as const,
        load: () => {
          throw new Error('kaboom');
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

  it('throw on re-merge → config kept, onDebug routed', async () => {
    let shouldThrow = false;
    const { contexts, callback } = createDebugCollector();

    const hooks = [
      {
        name: 'conditional',
        lifecycle: 'before:defaults' as const,
        load: () => {
          if (shouldThrow) {
            throw new Error('re-merge boom');
          }
          return { hookKey: 'hook-value' };
        },
      },
    ];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
      onDebug: callback,
    } as never);

    expect(store!.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    shouldThrow = true;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual({ hookKey: 'hook-value', port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EHOOK')).toBe(true);

    await store!.stop();
  });

  it('hook recovery: stop throwing on re-merge → config updates', async () => {
    let shouldThrow = false;

    const hooks = [
      {
        name: 'conditional',
        lifecycle: 'before:defaults' as const,
        load: () => {
          if (shouldThrow) {
            throw new TypeError('re-merge boom');
          }
          return {};
        },
      },
    ];

    const { callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      onDebug: callback,
    } as never);

    shouldThrow = true;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    shouldThrow = false;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9090 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 9090 });

    await store!.stop();
  });

  it('async hook in loadConfigSync: error message contains hook name', async () => {
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
    ).toThrow(/async-hook/);
  });
});
