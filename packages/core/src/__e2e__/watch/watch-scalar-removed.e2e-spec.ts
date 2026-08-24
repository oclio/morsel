import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-scalar-removed — remove key from project file', () => {
  clearWatcherRegistry();

  it('emits listener with next undefined and prev value', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('host', (event) => {
      events.push({ next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(store!, (config) => !('host' in config));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: undefined, prev: 'localhost' });

    await store!.stop();
  });
});
