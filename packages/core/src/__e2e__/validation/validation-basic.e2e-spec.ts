import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-basic — plugin behavior', () => {
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

  it('boot throw: validation fail at boot → ValidationError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: -1,
    });

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === -1) {
        throw new Error('port must be positive');
      }
      return config;
    };

    await expect(
      loadConfig({
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

  it('adds keys: plugin adds new keys to config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const validationPlugin = {
      name: 'enricher',
      validate: (config: Record<string, unknown>) => ({
        ...config,
        extra: true,
        nested: { added: 'by-plugin' },
      }),
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [validationPlugin],
    });

    expect(config).toEqual({
      port: 3000,
      extra: true,
      nested: { added: 'by-plugin' },
    });
  });

  it('transform: plugin coerces values', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
      debug: 'true',
    });

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

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'coerce', validate }],
    });

    expect(config).toEqual({ port: 3000, debug: true });
    expect(typeof config['port']).toBe('number');
    expect(typeof config['debug']).toBe('boolean');
  });

  it('chain: 2 plugins, output of P1 feeds P2', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
    });

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

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [
        { name: 'coerce', validate: coerce },
        { name: 'defaults', validate: addDefault },
      ],
    });

    expect(config).toEqual({ host: 'localhost', port: 3000 });
  });

  it('empty plugins: no plugins → config passes through', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: 'localhost' });
  });

  it('mutable input: first plugin receives mutable (non-frozen) config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    let wasMutable = false;

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config, extra: true };
      if (!Object.isFrozen(config)) {
        wasMutable = true;
      }
      return result;
    };

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'check-mutable', validate }],
    });

    expect(wasMutable).toBe(true);
  });

  it('plugin removes keys', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      secret: 'should-be-stripped',
    });

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config };
      delete result['secret'];
      return result;
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'strip-secret', validate }],
    });

    expect(config).toEqual({ port: 3000 });
    expect(config['secret']).toBeUndefined();
  });

  it('plugin passthrough: returns same config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const validate = (config: Record<string, unknown>) => config;

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'passthrough', validate }],
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('validate is sync only — returning a Promise does not await', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const validate = (config: Record<string, unknown>) =>
      ({ ...config, async: true }) as Record<string, unknown>;

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'sync-only', validate }],
    });

    expect(config).toEqual({ port: 3000, async: true });
  });
});
