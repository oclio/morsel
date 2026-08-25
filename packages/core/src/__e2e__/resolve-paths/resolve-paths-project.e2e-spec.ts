import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

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
});
