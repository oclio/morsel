import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-defaults-only — defaults resolve $env and strip extends', () => {
  clearWatcherRegistry();

  it('defaults: $env resolved per envName, extends stripped, no file on disk', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: {
        port: 3000,
        host: 'localhost',
        $env: {
          production: { port: 9000, debug: false },
          development: { port: 4000, debug: true },
        },
        extends: './should-be-stripped.json',
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 9000, host: 'localhost', debug: false });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      port: 9000,
      host: 'localhost',
      debug: false,
    });
    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({});
  });
});
