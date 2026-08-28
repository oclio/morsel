import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  writeConfig,
} from '@oclio/test-helpers';

import { createStore } from '@/index';

describe('createStore — static mode', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('boots and reads config without watchers', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.get('port')).toBe(3000);
    await store.stop();
  });

  it('does not react to external file changes', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 9999,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.get('port')).toBe(3000);

    await store.stop();
  });

  it('store.config returns raw config object (no proxy)', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const config = store.config;
    expect(config).toEqual({ port: 3000, host: 'localhost' });

    await store.stop();
  });

  it('store.get() works without proxy', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { server: { port: 3000, host: 'localhost' } },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.get('server.port')).toBe(3000);
    expect(store.get('server.host')).toBe('localhost');
    expect(store.has('server')).toBe(true);

    await store.stop();
  });

  it('frozen config is frozen', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'frozen',
    });

    expect(Object.isFrozen(store.config)).toBe(true);

    await store.stop();
  });

  it('mutable config: direct modification does not persist to disk', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const store = await createStore({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    (store.config as Record<string, unknown>)['port'] = 9999;
    expect(store.get('port')).toBe(9999);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['port']).toBe(3000);

    await store.stop();
  });
});
