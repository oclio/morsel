import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('env-stripped — $env stripped from result', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('$env key not in config nor in any layer.config', async () => {
    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
        extends: './base.json',
      },
      envName: 'ci',
    });

    const { config, layers } = result!;

    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
      expect(layer.config).not.toHaveProperty('extends');
    }
  });

  it('$env stripped from all 4 layers simultaneously', async () => {
    const { result } = await setupTest({
      globalConfig: {
        port: 8080,
        $env: { ci: { port: 9090 } },
      },
      projectConfig: {
        port: 3000,
        $env: { ci: { port: 9000 } },
      },
      envName: 'ci',
      defaults: { port: 4000, $env: { ci: { port: 7000 } } },
      overrides: { port: 6000, $env: { ci: { port: 9999 } } },
    });

    const { config, layers } = result!;

    expect(config).not.toHaveProperty('$env');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
    }
  });
});
