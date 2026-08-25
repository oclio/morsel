import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-merge — merge + prototype protection', () => {
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

  it('arrays are concatenated with arrayMerge: concat', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['c', 'd'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: ['default'] },
      overrides: { tags: ['override'] },
      arrayMerge: 'concat',
    });

    expect(config).toEqual({
      tags: ['default', 'a', 'b', 'c', 'd', 'override'],
    });
  });

  it('arrays are replaced, not concatenated', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c'],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['x', 'y'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: ['default'] },
    });

    expect(config).toEqual({ tags: ['x', 'y'] });
  });

  it('__proto__ key in config file silently skipped by deepMerge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      __proto__: { polluted: true },
      port: 3000,
    } as never);

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000 });
    expect((config as Record<string, unknown>)['__proto__']).toBe(
      Object.prototype,
    );
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});
