import { chmod } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-unshift — unshift()', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unshift adds to start and returns 0', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const result = await store.unshift('tags', 'z');

    expect(result).toBe(0);
    expect(store.get('tags')).toEqual(['z', 'a', 'b']);

    await store.stop();
  });

  it('unshift on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(store.unshift('port', 'x')).rejects.toMatchObject({
      code: 'EVALIDATE',
    });

    await store.stop();
  });

  it('unshift rollback on write failure restores previous config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await chmod(projectDirectory, 0o555);

    await expect(store.unshift('tags', 'z')).rejects.toThrow();

    expect(store.get('tags')).toEqual(['a', 'b']);

    await chmod(projectDirectory, 0o755);
    await store.stop();
  });
});
