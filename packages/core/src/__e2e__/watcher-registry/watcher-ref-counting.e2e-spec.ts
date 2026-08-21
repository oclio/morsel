import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-ref-counting — 2 stores same dir, shared watcher', () => {
  clearWatcherRegistry();

  it('stop() of first does not close watcher, stop() of second does', async () => {
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

    await store1.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store2,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store2.config).toEqual({ port: 8080 });

    await store2.stop();
  });
});
