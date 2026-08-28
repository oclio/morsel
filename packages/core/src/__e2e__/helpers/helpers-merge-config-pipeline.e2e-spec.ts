import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

import {
  createReactiveStore,
  defineConfig,
  loadConfig,
  loadConfigSync,
  mergeConfig,
} from '@/index';

describe('helpers-merge-config-pipeline — mergeConfig + pipeline integration', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('mergeConfig + loadConfig → merged defaults applied', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 8080 },
      createGlobalDir: true,
    });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, host: 'localhost' },
    });

    const merged = mergeConfig(base, {
      defaults: { host: 'production.example.com' },
    });

    const { config } = await loadConfig(merged);

    expect(config).toEqual({
      port: 8080,
      host: 'production.example.com',
    });
  });

  it('mergeConfig + loadConfigSync → merged defaults applied in sync mode', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 8080 },
      createGlobalDir: true,
    });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, host: 'localhost' },
    });

    const merged = mergeConfig(base, {
      defaults: { host: 'production.example.com' },
    });

    const { config } = loadConfigSync(merged);

    expect(config).toEqual({
      port: 8080,
      host: 'production.example.com',
    });
  });

  it('mergeConfig + createReactiveStore → merged defaults applied in watch mode', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { port: 8080 },
      createGlobalDir: true,
    });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, host: 'localhost' },
    });

    const merged = mergeConfig(base, {
      defaults: { host: 'production.example.com' },
    });

    const store = await createReactiveStore(merged);

    expect(store.config).toEqual({
      port: 8080,
      host: 'production.example.com',
    });

    await store.stop();
  });

  it('mergeConfig + loadConfig with arrayMerge concat → arrays concatenated in pipeline', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      reactive: false,
      projectConfig: { items: [9, 10] },
      createGlobalDir: true,
    });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { items: [1, 2] },
      arrayMerge: 'replace',
    });

    const merged = mergeConfig(base, {
      defaults: { items: [3, 4] },
      arrayMerge: 'concat',
    });

    const { config } = await loadConfig(merged);

    expect(config).toEqual({ items: [1, 2, 3, 4, 9, 10] });
  });
});
