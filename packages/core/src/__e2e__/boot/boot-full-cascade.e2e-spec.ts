import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-full-cascade — defaults + global + project + overrides all present', () => {
  clearWatcherRegistry();

  it('deep-merges all layers by increasing priority', async () => {
    const { result } = await setupTest({
      globalConfig: {
        port: 8080,
        host: '0.0.0.0',
        features: { auth: false, cache: true },
      },
      projectConfig: {
        port: 3000,
        features: { auth: true, logging: true },
      },
      defaults: { port: 4000, host: 'localhost', features: { cache: false } },
      overrides: { host: '127.0.0.1' },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      features: { auth: true, cache: true, logging: true },
    });

    expect(layers).toHaveLength(4);
    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(true);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });
});
