import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-validation — validation plugins', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('validation plugin that passes → config loaded with plugin applied', async () => {
    const validate = (config: Record<string, unknown>) => ({
      ...config,
      validated: true,
    });

    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      validationPlugins: [{ name: 'enricher', validate }],
    });

    expect(result!.config).toEqual({ port: 3000, validated: true });
  });

  it('throws ValidationError when plugin rejects config', async () => {
    const validate = (config: Record<string, unknown>) => {
      if (typeof config['port'] !== 'number') {
        throw new TypeError('port must be a number');
      }
      return config;
    };

    await expect(
      setupTest({
        projectConfig: { port: 'not-a-number' },
        validationPlugins: [{ name: 'port-type', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });
  });
});
