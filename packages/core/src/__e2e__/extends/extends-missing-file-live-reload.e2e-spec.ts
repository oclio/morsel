import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('extends-missing-file-live-reload — B created after boot', () => {
  clearWatcherRegistry();

  it('creating B triggers re-merge, B now included', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

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

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });

    await waitForRemerge(store, (config) => config['host'] === '0.0.0.0');

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await store.stop();
  });
});
