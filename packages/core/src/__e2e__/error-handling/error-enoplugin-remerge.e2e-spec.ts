import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('error-enoplugin-remerge — unsupported extension on re-merge', () => {
  clearWatcherRegistry();

  it('re-merge to .yaml extends → config preserved, no crash', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = `${directory}/global`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await writeFile(
      path.resolve(projectDirectory, 'base.yaml'),
      'port: 9999',
      'utf8',
    );

    const { contexts, callback } = createDebugCollector();

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      onDebug: callback,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.yaml',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ENOPLUGIN')).toBe(
      true,
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });
});
