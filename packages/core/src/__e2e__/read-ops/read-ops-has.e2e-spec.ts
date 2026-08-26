import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('read-ops-has — has() API', () => {
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

  it('has(path): true when key exists and defined', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        port: 3000,
        host: 'localhost',
        database: { host: 'db.example.com' },
      },
    });

    expect(store.has('port')).toBe(true);
    expect(store.has('host')).toBe(true);
    expect(store.has('database.host')).toBe(true);

    await store.stop();
  });

  it('has(path): false when key missing', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(store.has('missing')).toBe(false);
    expect(store.has('server.host')).toBe(false);

    await store.stop();
  });

  it('has(path): false when key exists but undefined', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, server: { host: 'localhost' } },
    });

    expect(store.has('server.missing.nested')).toBe(false);
    expect(store.has('nonexistent')).toBe(false);

    await store.stop();
  });

  it('has on dotted path', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: { host: 'localhost', port: 3000 },
      },
    });

    expect(store.has('server.host')).toBe(true);
    expect(store.has('server.port')).toBe(true);
    expect(store.has('server.missing')).toBe(false);

    await store.stop();
  });

  it('has on array index', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
    });

    expect(store.has('users[0].name')).toBe(true);
    expect(store.has('users[1].name')).toBe(true);
    expect(store.has('users[2].name')).toBe(false);
    expect(store.has('users[0].missing')).toBe(false);

    await store.stop();
  });

  it('has with array path input', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: { host: 'localhost', port: 3000 },
        users: [{ name: 'Alice' }],
      },
    });

    expect(store.has(['server', 'host'])).toBe(true);
    expect(store.has(['server', 'port'])).toBe(true);
    expect(store.has(['server', 'missing'])).toBe(false);
    expect(store.has(['users', 0, 'name'])).toBe(true);
    expect(store.has(['users', 1, 'name'])).toBe(false);

    await store.stop();
  });

  it('has after stop: still works', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.has('port')).toBe(true);

    await store.stop();

    expect(store.has('port')).toBe(true);
    expect(store.has('host')).toBe(true);
    expect(store.has('missing')).toBe(false);
  });
});
