import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-handle-event — watch event dispatch', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('handleWatchEvent filters by watchedFiles — only matching filename fires', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await writeConfig(projectDirectory, 'other.json', { host: 'localhost' });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    let isPortChanged = false;
    store.on('port', () => {
      isPortChanged = true;
    });

    await writeConfig(projectDirectory, 'other.json', { host: '0.0.0.0' });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(isPortChanged).toBe(false);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(isPortChanged).toBe(true);

    await store.stop();
  });

  it('handleWatchEvent with no filename → wildcard fallback to all stores', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store1 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    let isStore1Fired = false;
    let isStore2Fired = false;
    store1.on('port', () => {
      isStore1Fired = true;
    });
    store2.on('port', () => {
      isStore2Fired = true;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await Promise.all([
      waitForRemerge(
        store1,
        (config) => (config as Record<string, unknown>)['port'] === 8080,
      ),
      waitForRemerge(
        store2,
        (config) => (config as Record<string, unknown>)['port'] === 8080,
      ),
    ]);

    expect(isStore1Fired).toBe(true);
    expect(isStore2Fired).toBe(true);

    await store1.stop();
    await store2.stop();
  });

  it('debounce key per file+store — independent debounce per store', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store1 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      watchDebounce: 50,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      watchDebounce: 200,
    });

    let store1FiredAt = 0;
    let store2FiredAt = 0;
    store1.on('port', () => {
      store1FiredAt = Date.now();
    });
    store2.on('port', () => {
      store2FiredAt = Date.now();
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store1,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );
    await waitForRemerge(
      store2,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store1FiredAt).toBeGreaterThan(0);
    expect(store2FiredAt).toBeGreaterThan(0);
    expect(store1FiredAt).toBeLessThan(store2FiredAt);

    await store1.stop();
    await store2.stop();
  });
});
