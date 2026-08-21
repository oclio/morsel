import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('error-eparse-recover — corrupt then fix → re-merge succeeds', () => {
  clearWatcherRegistry();

  it('corrupt JSON then valid JSON → config updates', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: callback,
    });

    expect(store!.config).toEqual({ port: 3000 });

    const configPath = `${projectDirectory}/myapp.config.json`;
    await writeFile(configPath, '{ broken', 'utf8');

    const deadline = Date.now() + 5000;
    while (
      contexts.every((context) => context['code'] !== 'EPARSE') &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
