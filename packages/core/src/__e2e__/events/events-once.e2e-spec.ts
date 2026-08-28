import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

import { createReactiveStore } from '@/index';

describe('events-once — once option', () => {
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

  it('once: true auto-unsubscribes after first event', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await createReactiveStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    let calls = 0;
    store.on(
      'port',
      () => {
        calls++;
      },
      { once: true },
    );

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await waitForRemerge(store, (config) => config['port'] === 3001);

    expect(calls).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await waitForRemerge(store, (config) => config['port'] === 3002);

    expect(calls).toBe(1);

    await store.stop();
  });

  it('once: true on wildcard auto-unsubscribes after first match', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: 'localhost', port: 3000 },
    });

    const store = await createReactiveStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    let calls = 0;
    store.on(
      'server.*',
      () => {
        calls++;
      },
      { once: true },
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 3000 },
    });
    await waitForRemerge(
      store,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(calls).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '127.0.0.2', port: 3000 },
    });
    await waitForRemerge(
      store,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '127.0.0.2',
    );

    expect(calls).toBe(1);

    await store.stop();
  });
});
