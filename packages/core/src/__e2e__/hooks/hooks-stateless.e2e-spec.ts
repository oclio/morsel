import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('hooks-stateless — hook called at each merge, no state between calls', () => {
  clearWatcherRegistry();

  it('hook load called at boot and each re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    let callCount = 0;
    const hooks = [
      {
        name: 'counter',
        lifecycle: 'before:defaults' as const,
        load: () => {
          callCount++;
          return { call: callCount };
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(callCount).toBe(1);
    expect(store.config).toEqual({ call: 1, port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(callCount).toBe(2);
    expect(store.config).toEqual({ call: 2, port: 8080 });

    await store.stop();
  });
});
