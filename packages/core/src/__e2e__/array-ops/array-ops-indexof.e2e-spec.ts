import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-indexof — indexOf/lastIndexOf (sync)', () => {
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

  it('indexOf finds first matching index, -1 if absent', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'a', 'c'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.indexOf('tags', 'a')).toBe(0);
    expect(store.indexOf('tags', 'c')).toBe(3);
    expect(store.indexOf('tags', 'z')).toBe(-1);

    await store.stop();
  });

  it('lastIndexOf finds last matching index, -1 if absent', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'a', 'c'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.lastIndexOf('tags', 'a')).toBe(2);
    expect(store.lastIndexOf('tags', 'c')).toBe(3);
    expect(store.lastIndexOf('tags', 'z')).toBe(-1);

    await store.stop();
  });

  it('indexOf on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(() => store.indexOf('port', 3000)).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'EVALIDATE' }),
    );

    await store.stop();
  });

  it('lastIndexOf on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(() => store.lastIndexOf('port', 3000)).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'EVALIDATE' }),
    );

    await store.stop();
  });
});
