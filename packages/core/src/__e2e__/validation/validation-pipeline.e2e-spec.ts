import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, loadConfigSync, watchConfig } from '@/index';

describe('validation-pipeline — integration with pipeline', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('validation runs after interpolation', async () => {
    process.env['MORSEL_HOST'] = 'interpolated.example.com';
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: '${MORSEL_HOST}',
    });

    let receivedHost: unknown;
    const validate = (config: Record<string, unknown>) => {
      receivedHost = config['host'];
      return config;
    };

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'capture', validate }],
    });

    expect(receivedHost).toBe('interpolated.example.com');
    delete process.env['MORSEL_HOST'];
  });

  it('validation plugin receives interpolated config', async () => {
    process.env['MORSEL_PORT'] = '4000';
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '${MORSEL_PORT}',
    });

    let receivedPort: unknown;
    const validate = (config: Record<string, unknown>) => {
      receivedPort = config['port'];
      return config;
    };

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'capture', validate }],
    });

    expect(receivedPort).toBe('4000');
    delete process.env['MORSEL_PORT'];
  });

  it('validation in loadConfigSync', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
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
    await writeConfig(projectDirectory, 'myapp.config.json', { port: -1 });

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === -1) {
        throw new Error('port must be positive');
      }
      return config;
    };

    await expect(
      watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'positive', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });
  });

  it('validation in mutateKey (after optimistic update)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === 'invalid') {
        throw new Error('port must be a number');
      }
      return config;
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'port-type', validate }],
    });

    await expect(store.set('port', 'invalid')).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('validation in mutateKey rollback on failure', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === 'bad') {
        throw new Error('port must be a number');
      }
      return config;
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'rollback', validate }],
    });

    const originalConfig = store.config;

    await expect(store.set('port', 'bad')).rejects.toThrow();

    expect(store.config).toEqual(originalConfig);

    await store.stop();
  });

  it('multiple plugins, second throws → first already applied', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const first = (config: Record<string, unknown>) => ({
      ...config,
      firstApplied: true,
    });
    const second = () => {
      throw new Error('second failed');
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [
          { name: 'first', validate: first },
          { name: 'second', validate: second },
        ],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { second: 'second failed' },
    });
  });
});
