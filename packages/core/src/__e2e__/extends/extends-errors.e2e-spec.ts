import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, watchConfig } from '@/index';

describe('extends-errors — cycle and depth errors', () => {
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

  it('self cycle: A extends A → ECYCLE', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './myapp.config.json',
      port: 3000,
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'ECYCLE',
    });
  });

  it('cycle: A extends B extends A → ECYCLE', async () => {
    await writeConfig(projectDirectory, 'a.json', {
      extends: './b.json',
      port: 3000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './a.json',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './a.json',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'ECYCLE',
    });
  });

  it('cycle live reload: cycle via edit keeps config, onDebug routed', async () => {
    await writeConfig(projectDirectory, 'a.json', { port: 3000 });
    await writeConfig(projectDirectory, 'b.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './a.json',
    });

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'a.json', {
      extends: './b.json',
      port: 3000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './a.json',
      port: 8080,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ECYCLE')).toBe(true);

    await store.stop();
  });

  it('max depth: chain > 10 → ECYCLE', async () => {
    for (let index = 11; index > 0; index--) {
      const entry: Record<string, unknown> = {
        port: index,
        ['extends']: `./f${index - 1}.json`,
      };
      await writeConfig(projectDirectory, `f${index}.json`, entry);
    }
    await writeConfig(projectDirectory, 'f0.json', { port: 0 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './f11.json',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'ECYCLE',
    });
  });

  it('max depth exact: 10 levels succeeds, 11 fails', async () => {
    for (let index = 8; index > 0; index--) {
      const entry: Record<string, unknown> = {
        port: index,
        ['extends']: `./f${index - 1}.json`,
      };
      await writeConfig(projectDirectory, `f${index}.json`, entry);
    }
    await writeConfig(projectDirectory, 'f0.json', { port: 0 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './f8.json',
      port: 999,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 999 });
  });

  it('max depth live reload: chain >10 via edit keeps config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    for (let index = 11; index > 0; index--) {
      await writeConfig(projectDirectory, `f${index}.json`, {
        port: index,
        extends: `./f${index - 1}.json`,
      });
    }
    await writeConfig(projectDirectory, 'f0.json', { port: 0 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './f11.json',
      port: 3000,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ECYCLE')).toBe(true);

    await store.stop();
  });

  it('extends to non-JSON file with no plugin → ENOPLUGIN', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const iniPath = path.resolve(projectDirectory, 'base.ini');
    await writeFile(iniPath, 'host = 0.0.0.0\n', 'utf8');
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.ini',
      port: 3000,
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });

    vi.restoreAllMocks();
  });
});
