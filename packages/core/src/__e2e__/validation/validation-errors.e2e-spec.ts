import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

import { ValidationError } from '@/index';

describe('validation-errors — error handling', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('generic error wrapped: Error → ValidationError with { [name]: message }', async () => {
    const validate = () => {
      throw new Error('port must be positive');
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
      issues: { positive: 'port must be positive' },
    });
  });

  it('morsel error passthrough: ValidationError rethrown as-is', async () => {
    const validate = () => {
      throw new ValidationError({ port: 'must be between 1 and 65535' });
    };

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'range', validate }],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { port: 'must be between 1 and 65535' },
    });
  });

  it('non-Error thrown → String(error) in issues', async () => {
    const validate = () => {
      throw 'string error';
    };

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'string-throw', validate }],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { 'string-throw': 'string error' },
    });
  });

  it('ValidationError with multiple issues', async () => {
    const validate = () => {
      throw new ValidationError({
        port: 'must be between 1 and 65535',
        host: 'must be a string',
      });
    };

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'multi', validate }],
      } as never),
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
    const validate = () => {
      throw new ValidationError({ port: 'invalid' });
    };

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'msg', validate }],
      } as never),
    ).rejects.toThrow('validation failed (1 issue)');
  });

  it('ValidationError.path is always undefined', async () => {
    const validate = () => {
      throw new ValidationError({ port: 'invalid' });
    };

    let caught: ValidationError | undefined;
    try {
      await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        validationPlugins: [{ name: 'no-path', validate }],
      } as never);
    } catch (error) {
      caught = error as ValidationError;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught?.path).toBeUndefined();
  });
});
