import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, loadConfigSync, watchConfig } from '@/index';

describe('hooks-errors — hook errors', () => {
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

  it('throw at boot → MorselError(EHOOK)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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
      loadConfig({
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

  it('throw on re-merge → config kept, onDebug routed', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      onDebug: callback,
    });

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    shouldThrow = true;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EHOOK')).toBe(true);

    await store.stop();
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
    ).toThrow(/async-hook/);
  });
});
