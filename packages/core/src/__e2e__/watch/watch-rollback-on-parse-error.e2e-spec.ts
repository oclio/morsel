import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
} from '@oclio/morsel-e2e-helpers';

describe('watch-rollback-on-parse-error — corrupt file keeps config, watchers alive', () => {
  clearWatcherRegistry();

  it('corrupting project file fails re-merge, config kept, onDebug notified with EPARSE', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await store!.stop();
  });
});
