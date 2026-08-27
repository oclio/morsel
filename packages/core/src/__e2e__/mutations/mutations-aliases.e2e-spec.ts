import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/test-helpers';

describe('mutations-aliases — mutateKey/deleteKey aliases', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('mutateKey: same behavior as set', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.mutateKey('port', 8080);

    expect(store!.config).toEqual({ port: 8080 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('deleteKey: same behavior as unset', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
    });

    const result = await store!.deleteKey('host');

    expect(result).toBe(true);
    expect(store!.has('host')).toBe(false);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['host']).toBeUndefined();

    await store!.stop();
  });
});
