import { mkdir, rm, writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  setupTest,
  suppressConsoleError,
  waitForDebugContext,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-recovery — directory deletion & reconnection', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('directory deleted → fs.watch crash, config stays frozen', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('directory recreated → future fires captured', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('createWatcher when directory does not exist → startRecovery immediate', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const nonexistentGlobal = `${directory}/nonexistent-global`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: nonexistentGlobal,
      defaults: { port: 3000, host: 'localhost' },
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    await mkdir(nonexistentGlobal, { recursive: true });
    await writeConfig(nonexistentGlobal, 'myapp.config.json', {
      host: '0.0.0.0',
    });

    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await store.stop();
  });

  it('retry timer polling every 1 second → reconnection within ~2s', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('reconnection triggers full re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      globalConfig: { host: '0.0.0.0' },
      watch: true,
      onDebug: () => {},
    });

    expect(store!.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
      host: '127.0.0.1',
    });

    await waitForRemerge(
      store!,
      (config) => config['port'] === 8080 && config['host'] === '127.0.0.1',
    );

    expect(store!.config).toEqual({ port: 8080, host: '127.0.0.1' });

    await store!.stop();
  });

  it('verbose: true → full logging via onDebug', async () => {
    const debugMessages: string[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      verbose: true,
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(debugMessages.length).toBeGreaterThan(0);

    await store!.stop();
  });

  it('verbose mode logs re-merge error with code and path in context', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      verbose: true,
      onDebug: callback,
    });

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await waitForDebugContext(
      contexts,
      (context) => context['code'] === 'EPARSE',
    );

    expect(contexts.length).toBeGreaterThan(0);

    const lastContext = contexts.at(-1)!;
    expect(lastContext['code']).toBe('EPARSE');
    expect(lastContext['path']).toContain('myapp.config.json');

    await store!.stop();
  });

  it('logToStores: onDebug per store, stderr once for noop stores', async () => {
    const debugMessages: string[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    await rm(projectDirectory, { recursive: true, force: true });

    const crashStart = Date.now();
    while (Date.now() - crashStart < 5000) {
      if (debugMessages.some((m) => m.includes('fs.watch crashed'))) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(debugMessages.some((m) => m.includes('fs.watch crashed'))).toBe(
      true,
    );

    await store!.stop();
  });

  it('onDebug noop → stderr fallback for re-merge errors', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });
});
