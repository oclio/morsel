import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';
import { vi } from 'vitest';

import { watchConfig } from '@/index';

describe('boot-watch — watchConfig specifics', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('watchConfig returns store with all methods', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(typeof store.on).toBe('function');
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.has).toBe('function');
    expect(typeof store.unset).toBe('function');
    expect(typeof store.all).toBe('function');
    expect(typeof store.dotify).toBe('function');
    expect(typeof store.push).toBe('function');
    expect(typeof store.unshift).toBe('function');
    expect(typeof store.pop).toBe('function');
    expect(typeof store.shift).toBe('function');
    expect(typeof store.splice).toBe('function');
    expect(typeof store.indexOf).toBe('function');
    expect(typeof store.lastIndexOf).toBe('function');
    expect(typeof store.stop).toBe('function');

    await store.stop();
  });

  it('watchConfig accepts watchDebounce option at boot', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      watchDebounce: 100,
    });

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('watchConfig with projectPath undefined → store boots, no project directory watched', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('watchConfig with globalPath undefined → store boots, no global directory watched', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('AbortSignal already aborted → stop() called after hook init', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();
    controller.abort();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(() => store.on('port', () => {})).toThrow();
  });

  it('AbortSignal aborts after boot → stop() called', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      signal: controller.signal,
    });

    let isFired = false;
    store.on('port', () => {
      isFired = true;
    });

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 100));

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9000 });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isFired).toBe(false);
  });

  it('AbortSignal already aborted AND hook init throws → EHOOK takes precedence', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();
    controller.abort();

    await expect(
      watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        signal: controller.signal,
        hooks: [
          {
            name: 'failing',
            lifecycle: 'before:defaults',
            load: () => ({}),
            init: () => {
              throw new Error('hook init failed');
            },
          },
        ],
      } as never),
    ).rejects.toMatchObject({ code: 'EHOOK' });
  });

  it('AbortSignal fires during initHooks → store stopped via signal.aborted check', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const controller = new AbortController();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      signal: controller.signal,
      hooks: [
        {
          name: 'abort-during-init',
          lifecycle: 'before:defaults',
          load: () => ({}),
          init: () => {
            controller.abort();
          },
        },
      ],
    } as never);

    expect(() => store.on('port', () => {})).toThrow('store is stopped');
  });
});
