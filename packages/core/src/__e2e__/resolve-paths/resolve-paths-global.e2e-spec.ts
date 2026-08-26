import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { resolveGlobalPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { FormatPlugin } from '@/plugins/types';

describe('resolve-paths-global — resolveGlobalPath() discovery', () => {
  let directory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
  });

  it('resolveGlobalPath candidates: <globalDir>/<name>.config<ext>', async () => {
    const globalDirectory = path.resolve(directory, 'global');
    await mkdir(globalDirectory, { recursive: true });
    await writeFile(
      path.resolve(globalDirectory, 'myapp.config.json'),
      '{}\n',
      'utf8',
    );

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: globalDirectory },
      [jsonPlugin],
    );

    expect(result).toBe(path.resolve(globalDirectory, 'myapp.config.json'));
  });

  it('resolveGlobalPath returns undefined if none found', async () => {
    const globalDirectory = path.resolve(directory, 'empty-global');

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: globalDirectory },
      [jsonPlugin],
    );

    expect(result).toBeUndefined();
  });

  it('multi-plugin: first plugin extension for global', async () => {
    const yamlPlugin: FormatPlugin = {
      name: 'yaml',
      extensions: ['.yaml'],
      parse: () => ({}),
      serialize: () => '',
    };

    const globalDirectory = path.resolve(directory, 'global');
    await mkdir(globalDirectory, { recursive: true });
    await writeFile(
      path.resolve(globalDirectory, 'myapp.config.yaml'),
      '{}\n',
      'utf8',
    );

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: globalDirectory },
      [yamlPlugin, jsonPlugin],
    );

    expect(result).toBe(path.resolve(globalDirectory, 'myapp.config.yaml'));
  });
});
