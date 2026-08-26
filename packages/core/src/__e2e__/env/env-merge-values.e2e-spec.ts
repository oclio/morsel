import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-merge-values — $env override value types', () => {
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

  it('$env override with null value — null overwrites via deepMerge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: null },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: null });
  });

  it('$env override with undefined value — undefined ignored, original preserved', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: undefined },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('$env override with array value — array replaces per arrayMerge strategy', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
      $env: {
        ci: { tags: ['x'] },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).toEqual({ tags: ['x'] });
  });
});
