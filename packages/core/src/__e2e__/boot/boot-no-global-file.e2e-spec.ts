import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-no-global-file — global file missing', () => {
  clearWatcherRegistry();

  it('global layer exists:false, config = defaults + project + overrides', async () => {
    const { result } = await setupTest({
      createGlobalDir: true,
      projectConfig: { host: 'localhost' },
      defaults: { port: 3000 },
      overrides: { debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: 'localhost', debug: true });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);
    expect(globalLayer!.config).toEqual({});
    expect(globalLayer!.path).toBeUndefined();

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });
});
