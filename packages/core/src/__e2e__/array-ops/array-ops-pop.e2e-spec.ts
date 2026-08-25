import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-pop — pop()', () => {
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

  it('pop removes last element and returns its value', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store.pop('tags');

    expect(removed).toBe('c');
    expect(store.get('tags')).toEqual(['a', 'b']);

    await store.stop();
  });

  it('pop on empty array returns undefined', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: [],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store.pop('tags');

    expect(removed).toBeUndefined();
    expect(store.get('tags')).toEqual([]);

    await store.stop();
  });

  it('pop on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(store.pop('port')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store.stop();
  });
});
