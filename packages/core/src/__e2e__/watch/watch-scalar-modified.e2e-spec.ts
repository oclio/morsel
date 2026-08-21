import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-scalar-modified — change scalar in project file', () => {
  clearWatcherRegistry();

  it('emits listener with next and prev values', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('port', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: 8080, prev: 3000 });

    await store!.stop();
  });
});
