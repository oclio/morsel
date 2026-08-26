import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-debug — debug channels', () => {
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousNodeEnvironment === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = previousNodeEnvironment;
    }
  });

  it('$env undefined warns via onDebug', async () => {
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

  it('$env undefined with onDebug === noop — message goes to stderr', async () => {
    delete process.env['NODE_ENV'];

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

    expect(config).toEqual({ port: 3000 });
    expect(console.error).toHaveBeenCalled();
  });

  it('$env undefined with no onDebug option — message goes to stderr', async () => {
    delete process.env['NODE_ENV'];

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

    expect(config).toEqual({ port: 3000 });
    expect(console.error).toHaveBeenCalled();
  });

  it('re-merge failure with empty onDebug → no stderr, config kept', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: () => {},
    });

    const stderrSpy = vi.spyOn(console, 'error');

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(stderrSpy).not.toHaveBeenCalled();

    stderrSpy.mockRestore();
    await store!.stop();
  });

  it('re-merge failure without onDebug logs to stderr', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(stderrSpy).toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls
      .map((call) => String(call[0]))
      .join('');
    expect(stderrOutput).toContain('EPARSE');

    stderrSpy.mockRestore();
    await store!.stop();
  });
});
