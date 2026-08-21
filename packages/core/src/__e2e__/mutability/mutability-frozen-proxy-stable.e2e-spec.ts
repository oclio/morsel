import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutability-frozen-proxy-stable — same reference across re-merges', () => {
  clearWatcherRegistry();

  it('store.config returns same reference before and after re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    const referenceBefore = store.config;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const referenceAfter = store.config;

    expect(referenceBefore).toBe(referenceAfter);
    expect(referenceAfter).toEqual({ port: 8080 });

    await store.stop();
  });
});
