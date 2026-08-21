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

describe('hooks-watchable-live-reload — modify file in watchPaths triggers re-merge', () => {
  clearWatcherRegistry();

  it('editing a watched file from watchPaths triggers re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const hookDataPath = path.resolve(projectDirectory, 'env.json');

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });
    await writeFile(hookDataPath, JSON.stringify({ env: 'dev' }), 'utf8');

    const hooks = [
      {
        name: 'env-hook',
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

    expect(store.config).toEqual({ env: 'dev', port: 3000 });

    await writeFile(hookDataPath, JSON.stringify({ env: 'prod' }), 'utf8');
    await waitForRemerge(store, (config) => {
      const env = (config as Record<string, unknown>)['env'];
      return env === 'prod';
    });

    expect(store.config).toEqual({ env: 'prod', port: 3000 });

    await store.stop();
  });
});
