import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('extends-cycle-live-reload — cycle via edit keeps config, watchers alive', () => {
  clearWatcherRegistry();

  it('creating a cycle via edit fails re-merge, config kept', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'a.json', { port: 3000 });
    await writeConfig(projectDirectory, 'b.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './a.json',
    });

    await mkdir(`${directory}/global`, { recursive: true });

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'a.json', {
      extends: './b.json',
      port: 3000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './a.json',
      port: 8080,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ECYCLE')).toBe(true);

    await store.stop();
  });
});
