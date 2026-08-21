import { writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
} from '@oclio/morsel-e2e-helpers';

describe('error-verbose — verbose: true → detailed logs via onDebug', () => {
  clearWatcherRegistry();

  it('verbose mode logs re-merge error with code and path in context', async () => {
    const { messages, contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      verbose: true,
      onDebug: callback,
    });

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(messages.length).toBeGreaterThan(0);
    expect(contexts.length).toBeGreaterThan(0);

    const lastContext = contexts.at(-1)!;
    expect(lastContext['code']).toBe('EPARSE');
    expect(lastContext['path']).toContain('myapp.config.json');

    await store!.stop();
  });
});
