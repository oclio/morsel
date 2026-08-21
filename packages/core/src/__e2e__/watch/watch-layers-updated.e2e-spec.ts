import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-layers-updated — store.layers reflects re-merge', () => {
  clearWatcherRegistry();

  it('layers update with new paths and exists after re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const projectLayer = store!.layers.find((l) => l.source === 'project');
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const updatedProjectLayer = store!.layers.find(
      (l) => l.source === 'project',
    );
    expect(updatedProjectLayer?.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
