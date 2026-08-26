import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import {
  defineConfig,
  loadConfig,
  loadConfigSync,
  mergeConfig,
  watchConfig,
} from '@/index';

describe('helpers-merge-config-pipeline — mergeConfig + pipeline integration', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('mergeConfig + loadConfig → merged defaults applied', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

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
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

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

  it('mergeConfig + watchConfig → merged defaults applied in watch mode', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, host: 'localhost' },
    });

    const merged = mergeConfig(base, {
      defaults: { host: 'production.example.com' },
    });

    const store = await watchConfig(merged);

    expect(store.config).toEqual({
      port: 8080,
      host: 'production.example.com',
    });

    await store.stop();
  });

  it('mergeConfig + loadConfig with arrayMerge concat → arrays concatenated in pipeline', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: [9, 10],
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
