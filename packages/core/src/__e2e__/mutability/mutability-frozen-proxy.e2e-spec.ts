import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-test-helpers';

describe('mutability-frozen-proxy — stable Proxy behavior', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('frozen proxy stable: same reference across re-merges', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    const referenceBefore = store!.config;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const referenceAfter = store!.config;

    expect(referenceBefore).toBe(referenceAfter);
    expect(referenceAfter).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('nested proxy stable across re-merges', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { database: { host: 'localhost' } },
      watch: true,
      createGlobalDir: true,
    });

    const nestedBefore = (store!.config as Record<string, unknown>)['database'];

    await writeConfig(projectDirectory, 'myapp.config.json', {
      database: { host: 'example.com' },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config as Record<string, Record<string, unknown>>)['database']?.[
          'host'
        ] === 'example.com',
    );

    const nestedAfter = (store!.config as Record<string, unknown>)['database'];

    expect((nestedBefore as Record<string, unknown>)['host']).toBe(
      'example.com',
    );
    expect((nestedAfter as Record<string, unknown>)['host']).toBe(
      'example.com',
    );

    await store!.stop();
  });

  it('nested proxy returns undefined gracefully when key removed', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { database: { host: 'localhost' } },
      watch: true,
      createGlobalDir: true,
    });

    const nestedReference = (store!.config as Record<string, unknown>)[
      'database'
    ];

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3000,
    );

    expect(
      (nestedReference as Record<string, unknown>)['host'],
    ).toBeUndefined();

    await store!.stop();
  });

  it('array proxy: arrays wrapped in Proxy', async () => {
    const { store } = await setupTest({
      projectConfig: { items: ['a', 'b', 'c'] },
      watch: true,
      createGlobalDir: true,
    });

    const items = (store!.config as Record<string, unknown>)['items'];

    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual(['a', 'b', 'c']);

    await store!.stop();
  });
});
