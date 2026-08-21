import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('hooks-async-watchconfig — async hook in watchConfig at boot and re-merge', () => {
  clearWatcherRegistry();

  it('async hook awaited at boot and re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ hookKey: 'hook-value' }),
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 8080 });

    await store.stop();
  });
});
