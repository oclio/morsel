import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('env-debug — debug channels', () => {
  let previousNodeEnvironment: string | undefined;

  suppressConsoleError();

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

  it('$env undefined warns via onDebug', async () => {
    delete process.env['NODE_ENV'];

    const debugMessages: string[] = [];

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages.some((message) => message.includes('$env'))).toBe(
      true,
    );
  });

  it('$env undefined with onDebug === noop — message goes to stderr', async () => {
    delete process.env['NODE_ENV'];

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(console.error).toHaveBeenCalled();
  });

  it('$env undefined with no onDebug option — message goes to stderr', async () => {
    delete process.env['NODE_ENV'];

    const { result } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
    });

    expect(result!.config).toEqual({ port: 3000 });
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
