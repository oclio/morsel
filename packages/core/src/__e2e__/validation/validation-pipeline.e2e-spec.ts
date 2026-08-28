import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

import { loadConfigSync } from '@/index';

describe('validation-pipeline — integration with pipeline', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('validation runs after interpolation', async () => {
    process.env['MORSEL_HOST'] = 'interpolated.example.com';

    let receivedHost: unknown;
    const validate = (config: Record<string, unknown>) => {
      receivedHost = config['host'];
      return config;
    };

    await setupTest({
      projectConfig: { host: '${MORSEL_HOST}' },
      createGlobalDir: true,
      validationPlugins: [{ name: 'capture', validate }],
    } as never);

    expect(receivedHost).toBe('interpolated.example.com');
    delete process.env['MORSEL_HOST'];
  });

  it('validation plugin receives interpolated config', async () => {
    process.env['MORSEL_PORT'] = '4000';

    let receivedPort: unknown;
    const validate = (config: Record<string, unknown>) => {
      receivedPort = config['port'];
      return config;
    };

    await setupTest({
      projectConfig: { port: '${MORSEL_PORT}' },
      createGlobalDir: true,
      validationPlugins: [{ name: 'capture', validate }],
    } as never);

    expect(receivedPort).toBe('4000');
    delete process.env['MORSEL_PORT'];
  });

  it('validation in loadConfigSync', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: '3000' },
      createGlobalDir: true,
    });

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config };
      if (typeof result['port'] === 'string') {
        result['port'] = Number(result['port']);
      }
      return result;
    };

    const { config } = loadConfigSync({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'coerce', validate }],
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('validation in watchConfig boot → throws', async () => {
    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === -1) {
        throw new Error('port must be positive');
      }
      return config;
    };

    await expect(
      setupTest({
        projectConfig: { port: -1 },
        watch: true,
        createGlobalDir: true,
        validationPlugins: [{ name: 'positive', validate }],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });
  });

  it('multiple plugins, second throws → first already applied', async () => {
    const first = (config: Record<string, unknown>) => ({
      ...config,
      firstApplied: true,
    });
    const second = () => {
      throw new Error('second failed');
    };

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [
          { name: 'first', validate: first },
          { name: 'second', validate: second },
        ],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { second: 'second failed' },
    });
  });
});
