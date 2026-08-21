import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutability-mutable-reference-changes — new ref per re-merge', () => {
  clearWatcherRegistry();

  it('mutable mode: store.config returns new reference after re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      configMutability: 'mutable',
    });

    const referenceBefore = store.config;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const referenceAfter = store.config;

    expect(referenceBefore).not.toBe(referenceAfter);
    expect(referenceAfter).toEqual({ port: 8080 });

    await store.stop();
  });
});
