import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-create-project-file — boot without project file, then create it', () => {
  clearWatcherRegistry();

  it('creating project file triggers re-merge, layer project exists:true', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      createGlobalDir: true,
      defaults: { port: 3000 },
    });

    const projectLayer = store!.layers.find((l) => l.source === 'project');
    expect(projectLayer?.exists).toBe(false);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const updatedProjectLayer = store!.layers.find(
      (l) => l.source === 'project',
    );
    expect(updatedProjectLayer?.exists).toBe(true);

    await store!.stop();
  });
});
