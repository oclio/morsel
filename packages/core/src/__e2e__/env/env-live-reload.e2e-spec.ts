import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('env-live-reload — watch + $env', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('editing $env block applies new env values after re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
      watch: true,
      envName: 'ci',
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 9090 },
      },
    });

    await waitForRemerge(store!, (config) => config['port'] === 9090);

    expect(store!.config).toEqual({ port: 9090 });

    await store!.stop();
  });

  it('$env block added during watch — re-merge applies new env override', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {
        port: 3000,
      },
      watch: true,
      envName: 'ci',
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('$env block removed during watch — re-merge drops env override', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      },
      watch: true,
      envName: 'ci',
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    await waitForRemerge(store!, (config) => config['port'] === 3000);

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('NODE_ENV change after boot does not affect envName', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    try {
      const { store, projectDirectory } = await setupTest({
        projectConfig: {
          port: 3000,
          label: 'base',
          $env: {
            development: { label: 'dev' },
            production: { label: 'prod' },
          },
        },
        watch: true,
        createGlobalDir: true,
      });

      expect(store!.config).toEqual({ port: 3000, label: 'dev' });

      process.env['NODE_ENV'] = 'production';

      const portChanged = new Promise<void>((resolve) => {
        store!.on('port', () => resolve());
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

      expect(store!.config).toEqual({ port: 8080, label: 'dev' });

      await store!.stop();
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
