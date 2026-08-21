import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('edge-empty-config-file — project file with {}', () => {
  clearWatcherRegistry();

  it('empty {} config file → layer exists, config empty, no error', async () => {
    const { result } = await setupTest({ projectConfig: {} });

    expect(result!.config).toEqual({});
    const projectLayer = result!.layers.find(
      (layer) => layer.source === 'project',
    );
    expect(projectLayer).toBeDefined();
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.config).toEqual({});
  });
});
