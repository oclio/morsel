import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-minimal — no globalDir, no files, defaults + overrides only', () => {
  clearWatcherRegistry();

  it('defaults and overrides deep-merge when no globalDir and no files on disk', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      skipGlobalDirectory: true,
      defaults: { port: 3000, host: 'localhost' },
      overrides: { host: '0.0.0.0', debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', debug: true });
    expect(layers).toHaveLength(4);

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({ port: 3000, host: 'localhost' });
    expect(defaultsLayer!.path).toBeUndefined();

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);
    expect(globalLayer!.config).toEqual({});
    expect(globalLayer!.path).toBeUndefined();

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);
    expect(projectLayer!.config).toEqual({});
    expect(projectLayer!.path).toBeUndefined();

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({ host: '0.0.0.0', debug: true });
    expect(overridesLayer!.path).toBeUndefined();
  });
});
