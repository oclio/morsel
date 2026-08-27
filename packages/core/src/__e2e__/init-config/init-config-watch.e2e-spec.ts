import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-watch — watch integration', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('initConfig during active watch → fs.watch fires → re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      defaults: { port: 3000 },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 8080 },
    });

    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
