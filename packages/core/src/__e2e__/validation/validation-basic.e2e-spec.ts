import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('validation-basic — plugin behavior', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('boot throw: validation fail at boot → ValidationError(EVALIDATE)', async () => {
    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === -1) {
        throw new Error('port must be positive');
      }
      return config;
    };

    await expect(
      setupTest({
        projectConfig: { port: -1 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'positive', validate }],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });
  });

  it('adds keys: plugin adds new keys to config', async () => {
    const validationPlugin = {
      name: 'enricher',
      validate: (config: Record<string, unknown>) => ({
        ...config,
        extra: true,
        nested: { added: 'by-plugin' },
      }),
    };

    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [validationPlugin],
    } as never);

    expect(result!.config).toEqual({
      port: 3000,
      extra: true,
      nested: { added: 'by-plugin' },
    });
  });

  it('transform: plugin coerces values', async () => {
    const validate = (config: Record<string, unknown>) => {
      const result = { ...config };
      if (typeof result['port'] === 'string') {
        result['port'] = Number(result['port']);
      }
      if (result['debug'] === 'true') {
        result['debug'] = true;
      }
      return result;
    };

    const { result } = await setupTest({
      projectConfig: { port: '3000', debug: 'true' },
      createGlobalDir: true,
      validationPlugins: [{ name: 'coerce', validate }],
    } as never);

    expect(result!.config).toEqual({ port: 3000, debug: true });
    expect(typeof result!.config['port']).toBe('number');
    expect(typeof result!.config['debug']).toBe('boolean');
  });

  it('chain: 2 plugins, output of P1 feeds P2', async () => {
    const coerce = (config: Record<string, unknown>) => {
      const result = { ...config };
      if (typeof result['port'] === 'string') {
        result['port'] = Number(result['port']);
      }
      return result;
    };

    const addDefault = (config: Record<string, unknown>) => {
      return { host: 'localhost', ...config };
    };

    const { result } = await setupTest({
      projectConfig: { port: '3000' },
      createGlobalDir: true,
      validationPlugins: [
        { name: 'coerce', validate: coerce },
        { name: 'defaults', validate: addDefault },
      ],
    } as never);

    expect(result!.config).toEqual({ host: 'localhost', port: 3000 });
  });

  it('empty plugins: no plugins → config passes through', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ port: 3000, host: 'localhost' });
  });

  it('mutable input: first plugin receives mutable (non-frozen) config', async () => {
    let wasMutable = false;

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config, extra: true };
      if (!Object.isFrozen(config)) {
        wasMutable = true;
      }
      return result;
    };

    await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [{ name: 'check-mutable', validate }],
    } as never);

    expect(wasMutable).toBe(true);
  });

  it('plugin removes keys', async () => {
    const validate = (config: Record<string, unknown>) => {
      const result = { ...config };
      delete result['secret'];
      return result;
    };

    const { result } = await setupTest({
      projectConfig: { port: 3000, secret: 'should-be-stripped' },
      createGlobalDir: true,
      validationPlugins: [{ name: 'strip-secret', validate }],
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
    expect(result!.config['secret']).toBeUndefined();
  });

  it('plugin passthrough: returns same config', async () => {
    const validate = (config: Record<string, unknown>) => config;

    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [{ name: 'passthrough', validate }],
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('validate is sync only — returning a Promise does not await', async () => {
    const validate = (config: Record<string, unknown>) =>
      ({ ...config, async: true }) as Record<string, unknown>;

    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [{ name: 'sync-only', validate }],
    } as never);

    expect(result!.config).toEqual({ port: 3000, async: true });
  });
});
