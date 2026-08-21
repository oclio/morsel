import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('stop-layers-readable — store.layers readable after stop()', () => {
  clearWatcherRegistry();

  it('layers trace is readable after stop()', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const layersBefore = store!.layers.length;
    expect(layersBefore).toBeGreaterThan(0);

    await store!.stop();

    expect(store!.layers.length).toBe(layersBefore);
  });
});
