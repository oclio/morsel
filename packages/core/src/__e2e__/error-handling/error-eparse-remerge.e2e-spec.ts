import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
} from '@oclio/morsel-e2e-helpers';

describe('error-eparse-remerge — invalid JSON on re-merge, config preserved', () => {
  clearWatcherRegistry();

  it('re-merge with invalid JSON → config kept, onDebug called with EPARSE', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await store!.stop();
  });
});
