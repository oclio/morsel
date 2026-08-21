import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-no-project-file — project file missing', () => {
  clearWatcherRegistry();

  it('project layer exists:false, config:{}, path:undefined', async () => {
    const { result } = await setupTest({
      globalConfig: { host: '0.0.0.0' },
      defaults: { port: 3000 },
      overrides: { debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', debug: true });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(true);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);
    expect(projectLayer!.config).toEqual({});
    expect(projectLayer!.path).toBeUndefined();

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });
});
