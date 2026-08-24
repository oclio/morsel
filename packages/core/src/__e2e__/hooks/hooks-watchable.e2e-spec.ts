import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('hooks-watchable — LayerWatchableHook with watchPaths', () => {
  clearWatcherRegistry();

  it('watchPaths directory watched at boot', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const hookDataPath = path.resolve(projectDirectory, 'hook-data.json');

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });
    await writeFile(
      hookDataPath,
      JSON.stringify({ hookKey: 'initial' }),
      'utf8',
    );

    const hooks = [
      {
        name: 'file-hook',
        lifecycle: 'before:defaults' as const,
        watchPaths: [hookDataPath],
        load: () => {
          const data = readFileSync(hookDataPath, 'utf8');
          return JSON.parse(data) as Record<string, unknown>;
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(store.config).toEqual({ hookKey: 'initial', port: 3000 });

    await writeFile(
      hookDataPath,
      JSON.stringify({ hookKey: 'updated' }),
      'utf8',
    );
    await waitForRemerge(store, (config) => {
      const hookKey = (config as Record<string, unknown>)['hookKey'];
      return hookKey === 'updated';
    });

    expect(store.config).toEqual({ hookKey: 'updated', port: 3000 });

    await store.stop();
  });
});
