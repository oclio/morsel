import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-multi-listener — multiple listeners on same key', () => {
  clearWatcherRegistry();

  it('both listeners fire on change', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls1 = 0;
    let calls2 = 0;
    store!.on('port', () => {
      calls1++;
    });
    store!.on('port', () => {
      calls2++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(calls1).toBe(1);
    expect(calls2).toBe(1);

    store!.stop();
  });
});
