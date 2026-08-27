import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

describe('read-ops-has — has() API', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('has(path): true when key exists and defined', async () => {
    const { store } = await setupTest({
      defaults: {
        port: 3000,
        host: 'localhost',
        database: { host: 'db.example.com' },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('port')).toBe(true);
    expect(store!.has('host')).toBe(true);
    expect(store!.has('database.host')).toBe(true);

    await store!.stop();
  });

  it('has(path): false when key missing', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('missing')).toBe(false);
    expect(store!.has('server.host')).toBe(false);

    await store!.stop();
  });

  it('has(path): false when key exists but undefined', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000, server: { host: 'localhost' } },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('server.missing.nested')).toBe(false);
    expect(store!.has('nonexistent')).toBe(false);

    await store!.stop();
  });

  it('has on dotted path', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 3000 },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('server.host')).toBe(true);
    expect(store!.has('server.port')).toBe(true);
    expect(store!.has('server.missing')).toBe(false);

    await store!.stop();
  });

  it('has on array index', async () => {
    const { store } = await setupTest({
      defaults: {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('users[0].name')).toBe(true);
    expect(store!.has('users[1].name')).toBe(true);
    expect(store!.has('users[2].name')).toBe(false);
    expect(store!.has('users[0].missing')).toBe(false);

    await store!.stop();
  });

  it('has with array path input', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 3000 },
        users: [{ name: 'Alice' }],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has(['server', 'host'])).toBe(true);
    expect(store!.has(['server', 'port'])).toBe(true);
    expect(store!.has(['server', 'missing'])).toBe(false);
    expect(store!.has(['users', 0, 'name'])).toBe(true);
    expect(store!.has(['users', 1, 'name'])).toBe(false);

    await store!.stop();
  });

  it('has after stop: still works', async () => {
    const { store } = await setupTest({
      projectConfig: {
        port: 3000,
        host: 'localhost',
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.has('port')).toBe(true);

    await store!.stop();

    expect(store!.has('port')).toBe(true);
    expect(store!.has('host')).toBe(true);
    expect(store!.has('missing')).toBe(false);
  });
});
