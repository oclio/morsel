import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-lifecycle-debounce — debounce behavior', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('default: 3 rapid writes < 300ms → 1 re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let remergeCount = 0;
    store!.on('port', () => {
      remergeCount++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3003 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3003,
    );

    expect(remergeCount).toBe(1);

    await store!.stop();
  });

  it('custom: watchDebounce 100 → faster re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      watchDebounce: 100,
    });

    const start = Date.now();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(250);

    await store!.stop();
  });

  it('zero: watchDebounce 0 triggers immediate re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      watchDebounce: 0,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('pending remerge: fire during re-merge → pendingRemerge relaunches', async () => {
    let hookDelay = 0;

    const hooks = [
      {
        name: 'slow',
        lifecycle: 'before:defaults' as const,
        load: async () => {
          if (hookDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, hookDelay));
          }
          return {};
        },
      },
    ];

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      watchDebounce: 50,
    });

    expect(store!.config).toEqual({ port: 3000 });

    hookDelay = 200;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3002,
    );

    expect(store!.config).toEqual({ port: 3002 });

    await store!.stop();
  });

  it('stopped check in remerge: if store.stopped, remerge returns early', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const configBeforeStop = { ...store!.config };

    await store!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9999 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual(configBeforeStop);
  });
});
