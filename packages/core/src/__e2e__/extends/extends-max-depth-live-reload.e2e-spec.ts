import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('extends-max-depth-live-reload — chain >10 via edit keeps config', () => {
  clearWatcherRegistry();

  it('adding a chain >10 via edit fails re-merge, config kept', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    await mkdir(`${directory}/global`, { recursive: true });

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    for (let index = 11; index > 0; index--) {
      await writeConfig(projectDirectory, `f${index}.json`, {
        port: index,
        extends: `./f${index - 1}.json`,
      });
    }
    await writeConfig(projectDirectory, 'f0.json', { port: 0 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './f11.json',
      port: 3000,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ECYCLE')).toBe(true);

    await store.stop();
  });
});
