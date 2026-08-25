import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutability-frozen-proxy — stable Proxy behavior', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('frozen proxy stable: same reference across re-merges', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
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

  it('nested proxy stable across re-merges', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      database: { host: 'localhost' },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const nestedBefore = (store.config as Record<string, unknown>)['database'];

    await writeConfig(projectDirectory, 'myapp.config.json', {
      database: { host: 'example.com' },
    });
    await waitForRemerge(
      store,
      (config) =>
        (config as Record<string, Record<string, unknown>>)['database']?.[
          'host'
        ] === 'example.com',
    );

    const nestedAfter = (store.config as Record<string, unknown>)['database'];

    expect((nestedBefore as Record<string, unknown>)['host']).toBe(
      'example.com',
    );
    expect((nestedAfter as Record<string, unknown>)['host']).toBe(
      'example.com',
    );

    await store.stop();
  });

  it('nested proxy returns undefined gracefully when key removed', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      database: { host: 'localhost' },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const nestedReference = (store.config as Record<string, unknown>)[
      'database'
    ];

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 3000,
    );

    expect(
      (nestedReference as Record<string, unknown>)['host'],
    ).toBeUndefined();

    await store.stop();
  });

  it('array proxy: arrays wrapped in Proxy', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: ['a', 'b', 'c'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const items = (store.config as Record<string, unknown>)['items'];

    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual(['a', 'b', 'c']);

    await store.stop();
  });
});
