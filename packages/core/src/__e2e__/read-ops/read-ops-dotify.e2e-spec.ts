import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

describe('read-ops-dotify — dotify() API', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('dotify(): flatten to 1D dotted record', async () => {
    const { store } = await setupTest({
      defaults: {
        port: 3000,
        host: 'localhost',
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({
      port: 3000,
      host: 'localhost',
    });

    await store!.stop();
  });

  it('dotify on nested objects', async () => {
    const { store } = await setupTest({
      defaults: {
        server: {
          host: 'localhost',
          port: 3000,
          credentials: { user: 'admin', password: 'secret' },
        },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({
      'server.host': 'localhost',
      'server.port': 3000,
      'server.credentials.user': 'admin',
      'server.credentials.password': 'secret',
    });

    await store!.stop();
  });

  it('dotify on arrays', async () => {
    const { store } = await setupTest({
      defaults: {
        tags: ['a', 'b', 'c'],
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({
      'tags[0]': 'a',
      'tags[1]': 'b',
      'tags[2]': 'c',
      'users[0].name': 'Alice',
      'users[1].name': 'Bob',
    });

    await store!.stop();
  });

  it('dotify on keys with literal dots (escaped)', async () => {
    const { store } = await setupTest({
      defaults: {
        'app.config': { host: 'example.com', port: 8443 },
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({
      'app.config.host': 'example.com',
      'app.config.port': 8443,
    });

    await store!.stop();
  });

  it('dotify on primitives', async () => {
    const { store } = await setupTest({
      defaults: {
        port: 3000,
        enabled: true,
        ratio: 0.95,
        empty: '',
      },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({
      port: 3000,
      enabled: true,
      ratio: 0.95,
      empty: '',
    });

    await store!.stop();
  });

  it('dotify on empty config: returns {}', async () => {
    const { store } = await setupTest({
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.dotify()).toEqual({});

    await store!.stop();
  });

  it('dotify after stop: still works', async () => {
    const { store } = await setupTest({
      projectConfig: {
        port: 3000,
        server: { host: 'localhost' },
      },
      createGlobalDir: true,
      watch: true,
    });

    await store!.stop();

    expect(store!.dotify()).toEqual({
      port: 3000,
      'server.host': 'localhost',
    });
  });
});
