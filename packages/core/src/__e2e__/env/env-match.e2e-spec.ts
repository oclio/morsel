import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
} from '@oclio/test-helpers';

describe('env-match — envName matching edge cases', () => {
  let previousNodeEnvironment: string | undefined;

  beforeEach(() => {
    clearWatcherRegistry();
    previousNodeEnvironment = process.env['NODE_ENV'];
  });

  afterEach(() => {
    if (previousNodeEnvironment === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = previousNodeEnvironment;
    }
  });

  it('$env present but envName undefined — $env ignored, warning emitted', async () => {
    delete process.env['NODE_ENV'];

    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages.some((message) => message.includes('$env'))).toBe(
      true,
    );
  });

  it('envName matches no key in $env — $env stripped, no warning', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
          prod: { port: 9090 },
        },
      },
      envName: 'staging',
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('$env block empty — $env ignored silently', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {},
      },
      envName: 'ci',
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName empty string — matches nothing in $env', async () => {
    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          '': { port: 8080 },
        },
      },
      envName: '',
    });

    expect(result!.config).toEqual({ port: 8080 });
  });

  it('envName explicit undefined falls back to NODE_ENV', async () => {
    process.env['NODE_ENV'] = 'ci';

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
    });

    expect(result!.config).toEqual({ port: 8080 });
  });

  it.each([
    { name: 'string', value: 'not-an-object' },
    { name: 'number', value: 42 },
    { name: 'array', value: ['ci'] },
  ])(
    '$env block not a plain object ($name) — debug warning, $env ignored',
    async ({ value }) => {
      const { messages: debugMessages, callback } = createDebugCollector();

      const { result } = await setupTest({
        projectConfig: {
          port: 3000,
          $env: value,
        } as never,
        envName: 'ci',
        onDebug: callback,
      });

      expect(result!.config).toEqual({ port: 3000 });
      expect(debugMessages.some((message) => message.includes('$env'))).toBe(
        true,
      );
    },
  );

  it('envName matches but $env[envName] not a plain object — $env ignored silently', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: 'not-an-object',
        },
      },
      envName: 'ci',
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName matches but $env[envName] is null — $env ignored silently', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: null,
        },
      },
      envName: 'ci',
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName matches but $env[envName] is an array — $env ignored silently', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: ['not', 'an', 'object'],
        },
      },
      envName: 'ci',
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });
});
