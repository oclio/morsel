import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

describe('mutability-layers — layer audit trace', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('layers always frozen regardless of configMutability', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000, nested: { key: 'val' } },
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    for (const layer of result!.layers) {
      expect(Object.isFrozen(layer.config)).toBe(true);
      expect(Object.isFrozen(layer.extendsPaths)).toBe(true);
    }
  });

  it('layers readable in mutable mode — audit trace preserved', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    const projectLayer = result!.layers.find(
      (layer) => layer.source === 'project',
    );
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.exists).toBe(true);
    expect(projectLayer!.config).toEqual({ port: 3000 });
  });
});
