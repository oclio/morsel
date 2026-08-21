import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
} from '@oclio/morsel-e2e-helpers';

describe('error-on-debug-receives-errors — onDebug routes re-merge errors', () => {
  clearWatcherRegistry();

  it('re-merge failure routed to onDebug, not stderr', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: callback,
    });

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await store!.stop();
  });
});
