import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-file-ops — file create/delete/recreate', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('create project file: triggers re-merge, layer exists:true', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      createGlobalDir: true,
      defaults: { port: 3000 },
    });

    const projectLayer = store!.layers.find((l) => l.source === 'project');
    expect(projectLayer?.exists).toBe(false);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const updatedProjectLayer = store!.layers.find(
      (l) => l.source === 'project',
    );
    expect(updatedProjectLayer?.exists).toBe(true);

    await store!.stop();
  });

  it('create global file: triggers re-merge', async () => {
    const { store, globalDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '0.0.0.0',
    });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(store!.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await store!.stop();
  });

  it('delete project file: keeps last valid config frozen', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await rm(`${projectDirectory}/myapp.config.json`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await store!.stop();
  });

  it('delete global file: keeps last valid config frozen', async () => {
    const { store, globalDirectory } = await setupTest({
      watch: true,
      globalConfig: { host: '0.0.0.0', retries: 3 },
      projectConfig: { port: 3000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({
      port: 3000,
      host: '0.0.0.0',
      retries: 3,
    });

    const globalPath = path.resolve(globalDirectory, 'myapp.config.json');
    await rm(globalPath, { force: true });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({
      port: 3000,
      host: '0.0.0.0',
      retries: 3,
    });

    await store!.stop();
  });

  it('recreate project file: delete keeps config, recreate updates', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({ port: 3000 });

    await rm(`${projectDirectory}/myapp.config.json`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('simultaneous global and project: both changes in single re-merge', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      watch: true,
      globalConfig: { host: '0.0.0.0' },
      projectConfig: { port: 3000 },
    });

    expect(store!.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '127.0.0.1',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await waitForRemerge(
      store!,
      (config) => config['port'] === 8080 && config['host'] === '127.0.0.1',
    );

    expect(store!.config).toEqual({ port: 8080, host: '127.0.0.1' });

    await store!.stop();
  });

  it('no global dir: boots, detects changes, recovers when created', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = path.resolve(homedir(), '.config', 'otherapp');

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'otherapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'otherapp',
      cwd: projectDirectory,
      defaults: { port: 3000, host: 'localhost' },
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    await writeConfig(projectDirectory, 'otherapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080, host: 'localhost' });

    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(globalDirectory, 'otherapp.config.json', {
      host: '0.0.0.0',
    });

    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(store.config).toEqual({ port: 8080, host: '0.0.0.0' });

    await store.stop();
    await rm(globalDirectory, { recursive: true, force: true });
  });
});
