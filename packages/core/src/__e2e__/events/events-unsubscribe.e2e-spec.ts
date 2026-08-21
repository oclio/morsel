import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-unsubscribe — on() returns unsubscribe function', () => {
  clearWatcherRegistry();

  it('calling unsubscribe stops further events', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    const unsub = store!.on('port', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3001,
    );

    expect(calls).toBe(1);

    unsub();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3002,
    );

    expect(calls).toBe(1);

    store!.stop();
  });
});
