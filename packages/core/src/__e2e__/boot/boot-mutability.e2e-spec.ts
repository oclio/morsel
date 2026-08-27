import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('boot-mutability — freeze + layer shape', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('Object.isFrozen(config) is true by default', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000, tools: { eslint: true } },
    });

    expect(Object.isFrozen(result!.config)).toBe(true);
  });

  it('config is not frozen and can be mutated freely', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      configMutability: 'mutable',
    });

    expect(Object.isFrozen(result!.config)).toBe(false);

    const mutable = result!.config as Record<string, unknown>;
    mutable['port'] = 8080;
    expect(mutable['port']).toBe(8080);
  });

  it('MorselLayer shape: extendsPaths: [] on layers without extends, no hookName on core layers', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
    });

    for (const layer of result!.layers) {
      expect(layer).toHaveProperty('extendsPaths');
      expect(Array.isArray(layer.extendsPaths)).toBe(true);
      expect(layer.extendsPaths).toHaveLength(0);
      expect(layer).not.toHaveProperty('hookName');
    }
  });

  it('layers[].config is deep-frozen by toMorselLayer', async () => {
    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        nested: { deep: { value: true } },
      },
    });

    const projectLayer = result!.layers.find((l) => l.source === 'project');
    expect(Object.isFrozen(projectLayer!.config)).toBe(true);

    const nested = (projectLayer!.config as Record<string, unknown>)[
      'nested'
    ] as Record<string, unknown>;
    expect(Object.isFrozen(nested)).toBe(true);

    const deep = nested['deep'] as Record<string, unknown>;
    expect(Object.isFrozen(deep)).toBe(true);
  });
});
