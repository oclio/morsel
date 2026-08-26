import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('read-ops-all — all() API', () => {
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

  it("all(): deep clone snapshot, mutations on result don't affect store", async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        port: 3000,
        server: { host: 'localhost', port: 8080 },
      },
    });

    const snapshot = store.all();

    expect(snapshot).toEqual({
      port: 3000,
      server: { host: 'localhost', port: 8080 },
    });

    (snapshot as Record<string, unknown>)['port'] = 9999;
    ((snapshot as Record<string, unknown>)['server'] as { host: string }).host =
      'changed';

    expect(store.get('port')).toBe(3000);
    expect(store.get('server.host')).toBe('localhost');

    await store.stop();
  });

  it('all() after stop: returns last config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    const snapshot = store.all();

    expect(snapshot).toEqual({
      port: 3000,
      host: 'localhost',
    });
  });

  it('all() nested objects are distinct references', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: { host: 'localhost', port: 8080 },
        database: { host: 'db.example.com', port: 5432 },
      },
    });

    const snapshot = store.all();

    expect(snapshot).not.toBe(store.config);
    expect((snapshot as Record<string, unknown>)['server']).not.toBe(
      store.get('server'),
    );
    expect((snapshot as Record<string, unknown>)['database']).not.toBe(
      store.get('database'),
    );

    await store.stop();
  });

  it('unicode and emoji values preserved without corruption', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      name: 'café',
      emoji: '🚀',
      nested: { greeting: 'こんにちは' },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const snapshot = store.all();

    expect(snapshot).toEqual({
      name: 'café',
      emoji: '🚀',
      nested: { greeting: 'こんにちは' },
    });

    await store.stop();
  });
});
