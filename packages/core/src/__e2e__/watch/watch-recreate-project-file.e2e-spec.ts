import { rm } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-recreate-project-file — delete then recreate → config frozen then updated', () => {
  clearWatcherRegistry();

  it('delete keeps last config, recreate updates to new content', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({ port: 3000 });

    // Delete → config stays frozen at last valid state.
    await rm(`${projectDirectory}/myapp.config.json`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });

    // Recreate → config updates to new content.
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
