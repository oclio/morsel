import { chmod } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('array-ops-unshift — unshift()', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('unshift adds to start and returns new array length', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    const result = await store!.unshift('tags', 'z');

    expect(result).toBe(3);
    expect(store!.get('tags')).toEqual(['z', 'a', 'b']);

    await store!.stop();
  });

  it('unshift on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!.unshift('port', 'x')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });

  it('unshift rollback on write failure restores previous config', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    await chmod(projectDirectory, 0o555);

    await expect(store!.unshift('tags', 'z')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store!.get('tags')).toEqual(['a', 'b']);

    await chmod(projectDirectory, 0o755);
    await store!.stop();
  });
});
