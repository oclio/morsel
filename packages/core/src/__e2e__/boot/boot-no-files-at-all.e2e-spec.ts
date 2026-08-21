import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-no-files-at-all — defaults + overrides deep merge, no files', () => {
  clearWatcherRegistry();

  it('overlapping nested keys: overrides win per-key via deep merge, not full replace', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      defaults: {
        server: { host: 'localhost', port: 3000 },
        features: { cache: true, auth: false },
      },
      overrides: {
        server: { port: 9000 },
        features: { auth: true },
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      server: { host: 'localhost', port: 9000 },
      features: { cache: true, auth: true },
    });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      server: { host: 'localhost', port: 3000 },
      features: { cache: true, auth: false },
    });

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({
      server: { port: 9000 },
      features: { auth: true },
    });
  });
});
