import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-recover-after-error — corrupt then fix → re-merge succeeds', () => {
  clearWatcherRegistry();

  it('corrupting then fixing project file recovers config, onDebug notified with EPARSE', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: callback,
    });

    expect(store!.config).toEqual({ port: 3000 });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

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
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
