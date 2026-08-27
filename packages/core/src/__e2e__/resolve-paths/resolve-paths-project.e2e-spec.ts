import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import { loadConfig } from '@/index';
import { resolveProjectPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { FormatPlugin } from '@/plugins/types';

describe('resolve-paths-project — resolveProjectPath() discovery', () => {
  let directory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
  });

  it('.config/ directory convention: <cwd>/.config/<name><ext>', async () => {
    const cwd = path.resolve(directory, 'project');
    await mkdir(path.resolve(cwd, '.config'), { recursive: true });
    await writeFile(path.resolve(cwd, '.config', 'myapp.json'), '{}\n', 'utf8');

    const result = await resolveProjectPath({ name: 'myapp', cwd }, [
      jsonPlugin,
    ]);

    expect(result).toBe(path.resolve(cwd, '.config', 'myapp.json'));
  });

  it('root candidates checked first, then .config/', async () => {
    const cwd = path.resolve(directory, 'project');
    await mkdir(path.resolve(cwd, '.config'), { recursive: true });
    await writeFile(path.resolve(cwd, '.config', 'myapp.json'), '{}\n', 'utf8');
    await writeFile(path.resolve(cwd, 'myapp.config.json'), '{}\n', 'utf8');

    const result = await resolveProjectPath({ name: 'myapp', cwd }, [
      jsonPlugin,
    ]);

    expect(result).toBe(path.resolve(cwd, 'myapp.config.json'));
  });

  it('resolveProjectPath returns undefined if none found', async () => {
    const cwd = path.resolve(directory, 'empty-project');

    const result = await resolveProjectPath({ name: 'myapp', cwd }, [
      jsonPlugin,
    ]);

    expect(result).toBeUndefined();
  });

  it('plugin with multiple extensions → all extensions checked', async () => {
    const yamlPlugin: FormatPlugin = {
      name: 'yaml',
      extensions: ['.yaml', '.yml'],
      parse: () => ({}),
      serialize: () => '',
    };

    const cwd = path.resolve(directory, 'project');
    await mkdir(cwd, { recursive: true });
    await writeFile(path.resolve(cwd, 'myapp.config.yml'), '{}\n', 'utf8');

    const result = await resolveProjectPath({ name: 'myapp', cwd }, [
      jsonPlugin,
      yamlPlugin,
    ]);

    expect(result).toBe(path.resolve(cwd, 'myapp.config.yml'));
  });

  it('collectExtensions deduplicates', async () => {
    const duplicatePlugin: FormatPlugin = {
      name: 'json2',
      extensions: ['.json'],
      parse: () => ({}),
      serialize: () => '',
    };

    const cwd = path.resolve(directory, 'empty-project');

    const result = await resolveProjectPath({ name: 'myapp', cwd }, [
      jsonPlugin,
      duplicatePlugin,
    ]);

    expect(result).toBeUndefined();
  });

  it('symlinked config file is resolved via path.resolve, not realpath', async () => {
    const projectDirectory = path.resolve(directory, 'project');
    const targetDirectory = path.resolve(directory, 'target');

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeConfig(targetDirectory, 'myapp.config.json', { port: 3000 });

    const symlinkPath = path.resolve(projectDirectory, 'myapp.config.json');
    const targetPath = path.resolve(targetDirectory, 'myapp.config.json');
    await symlink(targetPath, symlinkPath);

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.path).toBe(symlinkPath);
    expect(projectLayer?.path).not.toBe(targetPath);
  });
});
