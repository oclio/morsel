import { readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('hooks-watchable — LayerWatchableHook', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('watchPaths directory watched at boot', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });
    const hookDataPath = path.resolve(projectDirectory, 'hook-data.json');

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
      globalDir: globalDirectory,
      hooks,
    });

    expect(store.config).toEqual({ hookKey: 'initial', port: 3000 });

    await writeFile(
      hookDataPath,
      JSON.stringify({ hookKey: 'updated' }),
      'utf8',
    );
    await waitForRemerge(store, (config) => config['hookKey'] === 'updated');

    expect(store.config).toEqual({ hookKey: 'updated', port: 3000 });

    await store.stop();
  });

  it('watchable live reload: modify file in watchPaths triggers re-merge', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });
    const hookDataPath = path.resolve(projectDirectory, 'env.json');

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
      globalDir: globalDirectory,
      hooks,
    });

    expect(store.config).toEqual({ env: 'dev', port: 3000 });

    await writeFile(hookDataPath, JSON.stringify({ env: 'prod' }), 'utf8');
    await waitForRemerge(store, (config) => config['env'] === 'prod');

    expect(store.config).toEqual({ env: 'prod', port: 3000 });

    await store.stop();
  });

  it('watchPaths directory deletion triggers retry', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });
    const watchedDirectory = path.resolve(projectDirectory, 'watched');
    const hookDataPath = path.resolve(watchedDirectory, 'data.json');

    await mkdir(watchedDirectory, { recursive: true });
    await writeFile(hookDataPath, JSON.stringify({ key: 'initial' }), 'utf8');

    const hooks = [
      {
        name: 'dir-hook',
        lifecycle: 'before:defaults' as const,
        watchPaths: [hookDataPath],
        load: () => {
          try {
            const data = readFileSync(hookDataPath, 'utf8');
            return JSON.parse(data) as Record<string, unknown>;
          } catch {
            return {};
          }
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(store.config).toEqual({ key: 'initial', port: 3000 });

    await rm(watchedDirectory, { recursive: true });
    await new Promise((resolve) => setTimeout(resolve, 300));

    await mkdir(watchedDirectory, { recursive: true });
    await writeFile(hookDataPath, JSON.stringify({ key: 'recreated' }), 'utf8');

    await waitForRemerge(
      store,
      (config) => config['key'] === 'recreated',
      5000,
    );

    expect(store.config).toEqual({ key: 'recreated', port: 3000 });

    await store.stop();
  });
});
