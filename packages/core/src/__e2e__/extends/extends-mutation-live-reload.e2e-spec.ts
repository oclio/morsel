import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('extends-mutation-live-reload — modifying B triggers re-merge', () => {
  clearWatcherRegistry();

  it('editing B updates config after re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '127.0.0.1',
    });

    await waitForRemerge(store, (config) => config['host'] === '127.0.0.1');

    expect(store.config).toEqual({ port: 3000, host: '127.0.0.1' });

    await store.stop();
  });
});
