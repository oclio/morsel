import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-overrides-only — overrides resolve $env and deep-merge over defaults', () => {
  clearWatcherRegistry();

  it('overrides: $env resolved per envName, extends stripped, deep-merged over defaults', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: { port: 3000, host: 'localhost', features: { cache: true } },
      overrides: {
        host: '0.0.0.0',
        features: { auth: true },
        $env: {
          production: { port: 9000, features: { cache: false } },
          development: { port: 4000 },
        },
        extends: './should-be-stripped.json',
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      port: 9000,
      host: '0.0.0.0',
      features: { cache: false, auth: true },
    });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({
      port: 9000,
      host: '0.0.0.0',
      features: { cache: false, auth: true },
    });
    expect(overridesLayer!.config).not.toHaveProperty('$env');
    expect(overridesLayer!.config).not.toHaveProperty('extends');
  });
});
