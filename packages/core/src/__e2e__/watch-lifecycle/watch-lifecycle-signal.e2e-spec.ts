import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  suppressConsoleError,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-signal — AbortSignal integration', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('signal already aborted → stop() called immediately', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();
    controller.abort();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(() => store.on('port', () => {})).toThrow();

    await store.stop();
  });

  it('signal aborts after boot → stop() called', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      signal: controller.signal,
    });

    expect(() => store.on('port', () => {})).not.toThrow();

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(() => store.on('port', () => {})).toThrow();

    await store.stop();
  });

  it('signal checked after hook init → abort during init stops store', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();

    const hooks = [
      {
        name: 'slow-init',
        lifecycle: 'before:defaults' as const,
        load: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {};
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      signal: controller.signal,
      hooks,
    });

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(() => store.on('port', () => {})).toThrow();

    await store.stop();
  });
});
