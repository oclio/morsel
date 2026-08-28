import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('read-ops-all — all() API', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it("all(): deep clone snapshot, modifications on result don't affect store", async () => {
    const { store } = await setupTest({
      defaults: {
        port: 3000,
        server: { host: 'localhost', port: 8080 },
      },
      createGlobalDir: true,
      watch: true,
    });

    const snapshot = store!.all();

    expect(snapshot).toEqual({
      port: 3000,
      server: { host: 'localhost', port: 8080 },
    });

    (snapshot as Record<string, unknown>)['port'] = 9999;
    ((snapshot as Record<string, unknown>)['server'] as { host: string }).host =
      'changed';

    expect(store!.get('port')).toBe(3000);
    expect(store!.get('server.host')).toBe('localhost');

    await store!.stop();
  });

  it('all() after stop: returns last config', async () => {
    const { store } = await setupTest({
      projectConfig: {
        port: 3000,
        host: 'localhost',
      },
      createGlobalDir: true,
      watch: true,
    });

    await store!.stop();

    const snapshot = store!.all();

    expect(snapshot).toEqual({
      port: 3000,
      host: 'localhost',
    });
  });

  it('all() nested objects are distinct references', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 8080 },
        database: { host: 'db.example.com', port: 5432 },
      },
      createGlobalDir: true,
      watch: true,
    });

    const snapshot = store!.all();

    expect(snapshot).not.toBe(store!.config);
    expect((snapshot as Record<string, unknown>)['server']).not.toBe(
      store!.get('server'),
    );
    expect((snapshot as Record<string, unknown>)['database']).not.toBe(
      store!.get('database'),
    );

    await store!.stop();
  });

  it('unicode and emoji values preserved without corruption', async () => {
    const { store } = await setupTest({
      projectConfig: {
        name: 'café',
        emoji: '🚀',
        nested: { greeting: 'こんにちは' },
      },
      createGlobalDir: true,
      watch: true,
    });

    const snapshot = store!.all();

    expect(snapshot).toEqual({
      name: 'café',
      emoji: '🚀',
      nested: { greeting: 'こんにちは' },
    });

    await store!.stop();
  });
});
