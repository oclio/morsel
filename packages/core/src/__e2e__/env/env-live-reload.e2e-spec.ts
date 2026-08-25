import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('env-live-reload — watch + $env', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(globalDirectory, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('editing $env block applies new env values after re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(store.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 9090 },
      },
    });

    await waitForRemerge(store, (config) => config['port'] === 9090);

    expect(store.config).toEqual({ port: 9090 });

    await store.stop();
  });

  it('$env block added during watch — re-merge applies new env override', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    await waitForRemerge(store, (config) => config['port'] === 8080);

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });

  it('$env block removed during watch — re-merge drops env override', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(store.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    await waitForRemerge(store, (config) => config['port'] === 3000);

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('NODE_ENV change after boot does not affect envName', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    try {
      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 3000,
        label: 'base',
        $env: {
          development: { label: 'dev' },
          production: { label: 'prod' },
        },
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(store.config).toEqual({ port: 3000, label: 'dev' });

      process.env['NODE_ENV'] = 'production';

      const portChanged = new Promise<void>((resolve) => {
        store.on('port', () => resolve());
      });

      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 8080,
        label: 'base',
        $env: {
          development: { label: 'dev' },
          production: { label: 'prod' },
        },
      });

      await portChanged;

      expect(store.config).toEqual({ port: 8080, label: 'dev' });

      await store.stop();
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
