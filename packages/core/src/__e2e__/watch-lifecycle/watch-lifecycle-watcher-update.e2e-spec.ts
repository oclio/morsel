import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-watcher-update — watcher update on re-merge', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('config always up to date → store.config reflects latest value', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('layers updated → layers update with new paths and exists', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    const projectLayer = store!.layers.find((l) => l.source === 'project');
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const updatedProjectLayer = store!.layers.find(
      (l) => l.source === 'project',
    );
    expect(updatedProjectLayer?.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('updateWatchers adds new directories for extends', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    const subdirectory = `${projectDirectory}/sub`;
    await writeConfig(subdirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './sub/base.json',
    });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 4000,
    );

    expect(store!.config).toEqual({ port: 4000 });

    await writeConfig(subdirectory, 'base.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('updateWatchers removes stale directories when extends removed', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
    });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store.config).toEqual({ port: 4000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 3000,
    );

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'base.json', { port: 9999 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('re-merge emits changes after watcher update success', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store!.on('port', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'modified', next: 8080, prev: 3000 });

    await store!.stop();
  });

  it('collectWatchedFiles called before setupWatchers (boot ordering)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      host: 'localhost',
    });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store.config).toEqual({ port: 4000, host: 'localhost' });

    await writeConfig(projectDirectory, 'base.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080, host: 'localhost' });

    await store.stop();
  });
});
