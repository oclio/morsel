import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-multi-store-same-dir — 2 stores same dir, independent debounce', () => {
  clearWatcherRegistry();

  it('two stores on same directory are fully independent', async () => {
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

    const writeTime = Date.now();
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store1,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );
    await waitForRemerge(
      store2,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store1.config).toEqual({ port: 8080 });
    expect(store2.config).toEqual({ port: 8080 });
    expect(store1FiredAt).toBeGreaterThan(writeTime);
    expect(store2FiredAt).toBeGreaterThan(writeTime);
    expect(store1FiredAt).toBeLessThan(store2FiredAt);

    await store1.stop();
    await store2.stop();
  });
});
