import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-splice — splice()', () => {
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

  it('splice removes and returns removed elements', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c', 'd'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store['splice']('tags', 1, 2);

    expect(removed).toEqual(['b', 'c']);
    expect(store.get('tags')).toEqual(['a', 'd']);

    await store.stop();
  });

  it('splice with negative start counts from end', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c', 'd'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store['splice']('tags', -2, 1);

    expect(removed).toEqual(['c']);
    expect(store.get('tags')).toEqual(['a', 'b', 'd']);

    await store.stop();
  });

  it('splice with deleteCount > length removes up to end', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store['splice']('tags', 1, 10);

    expect(removed).toEqual(['b']);
    expect(store.get('tags')).toEqual(['a']);

    await store.stop();
  });

  it('splice on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(store['splice']('port', 0, 1)).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store.stop();
  });

  it('splice with insert items inserts at start position', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const removed = await store['splice']('tags', 1, 1, 'x', 'y');

    expect(removed).toEqual(['b']);
    expect(store.get('tags')).toEqual(['a', 'x', 'y', 'c']);

    await store.stop();
  });
});
