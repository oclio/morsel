import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('error-ecycle-remerge — cycle created via edit, config kept, onDebug routed', () => {
  clearWatcherRegistry();

  it('cycle via edit → catch, config preserved, watchers alive', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = `${directory}/global`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'base.config.json', {
      port: 3000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.config.json',
    });

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'base.config.json', {
      extends: './myapp.config.json',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ECYCLE')).toBe(true);

    await writeConfig(projectDirectory, 'base.config.json', {
      port: 9000,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 9000 });

    await store.stop();
  });
});
