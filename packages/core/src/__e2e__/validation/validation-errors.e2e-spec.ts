import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, ValidationError } from '@/index';

describe('validation-errors — error handling', () => {
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

  it('generic error wrapped: Error → ValidationError with { [name]: message }', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: -1 });

    const validate = () => {
      throw new Error('port must be positive');
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
      issues: { positive: 'port must be positive' },
    });
  });

  it('morsel error passthrough: ValidationError rethrown as-is', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new ValidationError({ port: 'must be between 1 and 65535' });
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'range', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { port: 'must be between 1 and 65535' },
    });
  });

  it('non-Error thrown → String(error) in issues', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw 'string error';
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'string-throw', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { 'string-throw': 'string error' },
    });
  });

  it('ValidationError with multiple issues', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new ValidationError({
        port: 'must be between 1 and 65535',
        host: 'must be a string',
      });
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'multi', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: {
        port: 'must be between 1 and 65535',
        host: 'must be a string',
      },
    });
  });

  it('ValidationError message format: "validation failed (N issue(s))"', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new ValidationError({ port: 'invalid' });
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'msg', validate }],
      }),
    ).rejects.toThrow('validation failed (1 issue)');
  });

  it('ValidationError.path is always undefined', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new ValidationError({ port: 'invalid' });
    };

    let caught: ValidationError | undefined;
    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        validationPlugins: [{ name: 'no-path', validate }],
      });
    } catch (error) {
      caught = error as ValidationError;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught?.path).toBeUndefined();
  });
});
