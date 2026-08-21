import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-scalar-added — add new key to project file', () => {
  clearWatcherRegistry();

  it('emits listener with next value and prev undefined', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('host', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await waitForRemerge(store!, (config) => config['host'] === 'localhost');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: 'localhost', prev: undefined });

    await store!.stop();
  });
});
