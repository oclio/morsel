import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-arrays — array merge strategies', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('concat with missing layer — defaults has no tags, project has tags', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['c'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      arrayMerge: 'concat',
    });

    expect(config).toEqual({ tags: ['c'] });
  });

  it('concat with empty array — defaults tags:[], project tags:[c]', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['c'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: [] },
      arrayMerge: 'concat',
    });

    expect(config).toEqual({ tags: ['c'] });
  });

  it('replace with empty array — defaults tags:[a,b], project tags:[]', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: [],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: ['a', 'b'] },
    });

    expect(config).toEqual({ tags: [] });
  });

  it('array of objects with concat — objects cloned, not shared by reference', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      tags: [{ a: 1 }],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: [{ b: 2 }],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      arrayMerge: 'concat',
    });

    expect(config['tags']).toEqual([{ a: 1 }, { b: 2 }]);

    const tags = config['tags'] as Record<string, unknown>[];
    expect(tags[0]).not.toBe(tags[1]);
    expect(tags[0]).toEqual({ a: 1 });
    expect(tags[1]).toEqual({ b: 2 });
  });

  it('array of objects with replace — objects cloned', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      tags: [{ a: 1 }],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: [{ b: 2 }],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config['tags']).toEqual([{ b: 2 }]);

    const tags = config['tags'] as Record<string, unknown>[];
    expect(tags[0]).toEqual({ b: 2 });
  });

  it('array nested in object — array merge applies recursively', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      features: { tags: ['a'] },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      features: { tags: ['b'] },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      arrayMerge: 'concat',
    });

    expect(config).toEqual({
      features: { tags: ['a', 'b'] },
    });
  });

  it('array of arrays — outer array merged per strategy', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      matrix: [[1, 2]],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      matrix: [[3, 4]],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      arrayMerge: 'concat',
    });

    expect(config).toEqual({
      matrix: [
        [1, 2],
        [3, 4],
      ],
    });
  });
});
