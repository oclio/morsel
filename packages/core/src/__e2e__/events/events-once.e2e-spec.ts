import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-test-helpers';

describe('events-once — once option', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('once: true auto-unsubscribes after first event', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    let calls = 0;
    store!.on(
      'port',
      () => {
        calls++;
      },
      { once: true },
    );

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await waitForRemerge(store!, (config) => config['port'] === 3001);

    expect(calls).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await waitForRemerge(store!, (config) => config['port'] === 3002);

    expect(calls).toBe(1);

    await store!.stop();
  });

  it('once: true on wildcard auto-unsubscribes after first match', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { server: { host: 'localhost', port: 3000 } },
      watch: true,
    });

    let calls = 0;
    store!.on(
      'server.*',
      () => {
        calls++;
      },
      { once: true },
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 3000 },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(calls).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '1.1.1.1', port: 3000 },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '1.1.1.1',
    );

    expect(calls).toBe(1);

    await store!.stop();
  });
});
