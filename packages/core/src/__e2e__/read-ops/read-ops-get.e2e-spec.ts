import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('read-ops-get — get() API', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('get(path): read by dotted path', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 3000 },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('server.host')).toBe('localhost');
    expect(store!.get('server.port')).toBe(3000);

    await store!.stop();
  });

  it('get(path) on missing key: returns undefined', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('missing')).toBeUndefined();
    expect(store!.get('server.host')).toBeUndefined();

    await store!.stop();
  });

  it('get(path, defaultValue): returns default when missing', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('missing', 'fallback')).toBe('fallback');
    expect(store!.get('port', 9999)).toBe(3000);

    await store!.stop();
  });

  it('get on dotted path with missing intermediate segments returns undefined', async () => {
    const { store } = await setupTest({
      defaults: { server: { host: 'localhost' } },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('server.missing.nested')).toBeUndefined();
    expect(store!.get('nonexistent.path.deep')).toBeUndefined();

    await store!.stop();
  });

  it('get on array index (users[0].name)', async () => {
    const { store } = await setupTest({
      defaults: {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('users[0].name')).toBe('Alice');
    expect(store!.get('users[1].name')).toBe('Bob');
    expect(store!.get('users[0].age')).toBe(30);

    await store!.stop();
  });

  it('get on array index via dot notation (users.0.name)', async () => {
    const { store } = await setupTest({
      defaults: {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('users.0.name')).toBe('Alice');
    expect(store!.get('users.1.name')).toBe('Bob');
    expect(store!.get('users.0.age')).toBe(30);

    await store!.stop();
  });

  it('get on escaped dot (app\\.config.host)', async () => {
    const { store } = await setupTest({
      defaults: {
        'app.config': { host: 'example.com', port: 8443 },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('app\\.config.host')).toBe('example.com');
    expect(store!.get('app\\.config.port')).toBe(8443);

    await store!.stop();
  });

  it('get with array path input', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 3000 },
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get(['server', 'host'])).toBe('localhost');
    expect(store!.get(['server', 'port'])).toBe(3000);
    expect(store!.get(['users', 0, 'name'])).toBe('Alice');
    expect(store!.get(['users', 1, 'name'])).toBe('Bob');

    await store!.stop();
  });

  it('get after stop: still returns last config', async () => {
    const { store } = await setupTest({
      projectConfig: {
        port: 3000,
        host: 'localhost',
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('port')).toBe(3000);

    await store!.stop();

    expect(store!.get('port')).toBe(3000);
    expect(store!.get('host')).toBe('localhost');
    expect(store!.get('missing')).toBeUndefined();
  });

  it('get on non-array with numeric segment: returns undefined', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.get('port.0')).toBeUndefined();
    expect(store!.get('port[0]')).toBeUndefined();

    await store!.stop();
  });
});
