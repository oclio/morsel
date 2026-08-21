import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-extends-directory-watched — editing extends file triggers re-merge', () => {
  clearWatcherRegistry();

  it('modifying base.json triggers re-merge via directory watcher', async () => {
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
