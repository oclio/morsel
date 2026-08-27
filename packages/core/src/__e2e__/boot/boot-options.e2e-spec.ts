import { homedir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  setupTest,
  withEnvironmentVariable,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('boot-options — resolveOptions defaults', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cwd defaults to process.cwd()', async () => {
    const { directory } = await createTemporaryEnvironment();

    await writeConfig(directory, 'myapp.config.json', { port: 3000 });

    const cwdSpy = vi.spyOn(process, 'cwd');
    cwdSpy.mockReturnValue(directory);

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        globalDir: `${directory}/global`,
      });

      expect(config).toEqual({ port: 3000 });
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('globalDir defaults to ~/.config/<name>', async () => {
    const { directory } = await createTemporaryEnvironment();

    await writeConfig(directory, 'myapp.config.json', { port: 3000 });

    const homedirSpy = vi.spyOn(process, 'cwd');
    homedirSpy.mockReturnValue(directory);

    const globalDirectory = path.resolve(homedir(), '.config', 'myapp');

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: directory,
      });

      expect(config).toEqual({ port: 3000 });
      expect(globalDirectory).toBe(path.resolve(homedir(), '.config', 'myapp'));
    } finally {
      homedirSpy.mockRestore();
    }
  });

  it('arrayMerge defaults to replace', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { tags: ['a', 'b'] },
      globalConfig: { tags: ['c'] },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ tags: ['a', 'b'] });
  });

  it('configMutability defaults to frozen', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
    });

    expect(Object.isFrozen(result!.config)).toBe(true);
  });

  it('defaults: null treated as {}', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      defaults: null,
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('overrides: null treated as {}', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      overrides: null,
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('applies $env block matching explicit envName, not NODE_ENV', async () => {
    await withEnvironmentVariable('NODE_ENV', 'ci', async () => {
      const { result } = await setupTest({
        rootAsCwd: true,
        projectConfig: {
          port: 3000,
          $env: {
            ci: { port: 8080 },
            prod: { port: 9000 },
          },
        },
        envName: 'prod',
      });

      expect(result!.config).toEqual({ port: 9000 });
    });
  });

  it('applies $env block matching process.env.NODE_ENV', async () => {
    await withEnvironmentVariable('NODE_ENV', 'ci', async () => {
      const { result } = await setupTest({
        rootAsCwd: true,
        projectConfig: {
          port: 3000,
          $env: {
            ci: { port: 8080 },
            prod: { port: 9000 },
          },
        },
      });

      expect(result!.config).toEqual({ port: 8080 });
    });
  });

  it('ignores $env block and warns onDebug when NODE_ENV unset', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    await withEnvironmentVariable('NODE_ENV', undefined, async () => {
      const { result } = await setupTest({
        rootAsCwd: true,
        projectConfig: {
          port: 3000,
          $env: {
            ci: { port: 8080 },
          },
        },
        onDebug: callback,
      });

      expect(result!.config).toEqual({ port: 3000 });
      expect(debugMessages.length).toBeGreaterThan(0);
      expect(debugMessages.some((message) => message.includes('$env'))).toBe(
        true,
      );
    });
  });

  it('verbose: true accepted at boot, config loads without error', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      verbose: true,
    });

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('empty onDebug at boot → no stderr, config loaded', async () => {
    const stderrSpy = vi.spyOn(console, 'error');

    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      onDebug: () => {},
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(stderrSpy).not.toHaveBeenCalled();

    stderrSpy.mockRestore();
  });

  it('onDebug at boot only fires on warnings, not on clean boot', async () => {
    const { messages: debugMessages, callback } = createDebugCollector();

    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      onDebug: callback,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages).toEqual([]);
  });
});
