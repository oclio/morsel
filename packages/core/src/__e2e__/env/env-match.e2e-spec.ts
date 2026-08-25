import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-match — envName matching edge cases', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;
  let previousNodeEnvironment: string | undefined;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
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

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages.some((message) => message.includes('$env'))).toBe(
      true,
    );
  });

  it('envName matches no key in $env — $env stripped, no warning', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
        prod: { port: 9090 },
      },
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'staging',
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('$env block empty — $env ignored silently', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {},
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName empty string — matches nothing in $env', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        '': { port: 8080 },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: '',
    });

    expect(config).toEqual({ port: 8080 });
  });

  it('envName explicit undefined falls back to NODE_ENV', async () => {
    process.env['NODE_ENV'] = 'ci';

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 8080 });
  });

  it.each([
    { name: 'string', value: 'not-an-object' },
    { name: 'number', value: 42 },
    { name: 'array', value: ['ci'] },
  ])(
    '$env block not a plain object ($name) — debug warning, $env ignored',
    async ({ value }) => {
      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 3000,
        $env: value,
      } as never);

      const debugMessages: string[] = [];

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        envName: 'ci',
        onDebug: (message: string) => {
          debugMessages.push(message);
        },
      });

      expect(config).toEqual({ port: 3000 });
      expect(debugMessages.some((message) => message.includes('$env'))).toBe(
        true,
      );
    },
  );

  it('envName matches but $env[envName] not a plain object — $env ignored silently', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: 'not-an-object',
      },
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName matches but $env[envName] is null — $env ignored silently', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: null,
      },
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });

  it('envName matches but $env[envName] is an array — $env ignored silently', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: ['not', 'an', 'object'],
      },
    });

    const debugMessages: string[] = [];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(config).toEqual({ port: 3000 });
    expect(debugMessages).toHaveLength(0);
  });
});
