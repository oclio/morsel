import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig, watchConfig } from '@/index';

describe('extends-errors — cycle and depth errors', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('self cycle: A extends A → ECYCLE', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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

  it('cycle recovery: fix cycle via edit → config updates', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.config.json', {
      port: 3000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.config.json',
    });

    const { callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: callback,
    });

    await writeConfig(projectDirectory, 'base.config.json', {
      extends: './myapp.config.json',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await writeConfig(projectDirectory, 'base.config.json', {
      port: 9000,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 9000 });

    await store.stop();
  });

  it('max depth: chain > 10 → ECYCLE', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

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
