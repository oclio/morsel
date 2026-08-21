import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { clearRegistry, getRegistry, watchConfig } from '@/index';

describe('edge-stop-all-stores-releases-registry — registry empty after all stop', () => {
  clearWatcherRegistry();

  it('all stores stopped → registry is empty', async () => {
    clearRegistry();

    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = `${directory}/global`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(getRegistry().size).toBeGreaterThan(0);

    await store.stop();

    expect(getRegistry().size).toBe(0);
  });
});
