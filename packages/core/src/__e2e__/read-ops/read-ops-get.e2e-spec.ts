import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('read-ops-get — get() API', () => {
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

  it('get(path): read by dotted path', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: { host: 'localhost', port: 3000 },
      },
    });

    expect(store.get('server.host')).toBe('localhost');
    expect(store.get('server.port')).toBe(3000);

    await store.stop();
  });

  it('get(path) on missing key: returns undefined', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(store.get('missing')).toBeUndefined();
    expect(store.get('server.host')).toBeUndefined();

    await store.stop();
  });

  it('get(path, defaultValue): returns default when missing', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(store.get('missing', 'fallback')).toBe('fallback');
    expect(store.get('port', 9999)).toBe(3000);

    await store.stop();
  });

  it('get on dotted path with missing intermediate segments returns undefined', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { server: { host: 'localhost' } },
    });

    expect(store.get('server.missing.nested')).toBeUndefined();
    expect(store.get('nonexistent.path.deep')).toBeUndefined();

    await store.stop();
  });

  it('get on array index (users[0].name)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      },
    });

    expect(store.get('users[0].name')).toBe('Alice');
    expect(store.get('users[1].name')).toBe('Bob');
    expect(store.get('users[0].age')).toBe(30);

    await store.stop();
  });

  it('get on array index via dot notation (users.0.name)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      },
    });

    expect(store.get('users.0.name')).toBe('Alice');
    expect(store.get('users.1.name')).toBe('Bob');
    expect(store.get('users.0.age')).toBe(30);

    await store.stop();
  });

  it('get on escaped dot (app\\.config.host)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        'app.config': { host: 'example.com', port: 8443 },
      },
    });

    expect(store.get('app\\.config.host')).toBe('example.com');
    expect(store.get('app\\.config.port')).toBe(8443);

    await store.stop();
  });

  it('get with array path input', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: { host: 'localhost', port: 3000 },
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
    });

    expect(store.get(['server', 'host'])).toBe('localhost');
    expect(store.get(['server', 'port'])).toBe(3000);
    expect(store.get(['users', 0, 'name'])).toBe('Alice');
    expect(store.get(['users', 1, 'name'])).toBe('Bob');

    await store.stop();
  });

  it('get after stop: still returns last config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.get('port')).toBe(3000);

    await store.stop();

    expect(store.get('port')).toBe(3000);
    expect(store.get('host')).toBe('localhost');
    expect(store.get('missing')).toBeUndefined();
  });

  it('get on non-array with numeric segment: returns undefined', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(store.get('port.0')).toBeUndefined();
    expect(store.get('port[0]')).toBeUndefined();

    await store.stop();
  });
});
