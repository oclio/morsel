import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-multi-store-different-files — same dir, different names', () => {
  clearWatcherRegistry();

  it('two stores with different names filter by filename, no cross-fire', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'app1.config.json', { port: 3000 });
    await writeConfig(projectDirectory, 'app2.config.json', { port: 8080 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store1 = await watchConfig({
      name: 'app1',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });
    const store2 = await watchConfig({
      name: 'app2',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store1.config).toEqual({ port: 3000 });
    expect(store2.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'app1.config.json', { port: 4000 });

    await waitForRemerge(
      store1,
      (config) => (config as Record<string, unknown>)['port'] === 4000,
    );

    expect(store1.config).toEqual({ port: 4000 });
    expect(store2.config).toEqual({ port: 8080 });

    await store1.stop();
    await store2.stop();
  });
});
