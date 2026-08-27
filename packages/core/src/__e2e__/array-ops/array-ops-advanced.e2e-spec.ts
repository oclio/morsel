import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  suppressConsoleError,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-advanced — nested, target, stopped', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  suppressConsoleError();

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('array ops on nested array (items.0.tags)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: [{ tags: ['x', 'y'] }],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const newIndex = await store.push('items.0.tags', 'z');

    expect(newIndex).toBe(2);
    expect(store.get('items.0.tags')).toEqual(['x', 'y', 'z']);

    await store.stop();
  });

  it('array ops with target: global writes to global file', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.push('tags', 'c', 'global');

    expect(store.get('tags')).toEqual(['a', 'b', 'c']);

    await store.stop();
  });

  it('array ops with target: project writes to project file', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.push('tags', 'c', 'project');

    expect(store.get('tags')).toEqual(['a', 'b', 'c']);

    await store.stop();
  });

  it('array ops on stopped store throws Error(store is stopped)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    await expect(store.push('tags', 'b')).rejects.toThrow('store is stopped');
  });
});
