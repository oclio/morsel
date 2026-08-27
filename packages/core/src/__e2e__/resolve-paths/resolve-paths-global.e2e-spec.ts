import path from 'node:path';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

import { resolveGlobalPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { FormatPlugin } from '@/plugins/types';

describe('resolve-paths-global — resolveGlobalPath() discovery', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('resolveGlobalPath candidates: <globalDir>/<name>.config<ext>', async () => {
    const { globalDirectory } = await setupTest({
      rawFiles: [
        { filename: 'myapp.config.json', content: '{}\n', layer: 'global' },
      ],
      createGlobalDir: true,
    });

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: globalDirectory },
      [jsonPlugin],
    );

    expect(result).toBe(path.resolve(globalDirectory, 'myapp.config.json'));
  });

  it('resolveGlobalPath returns undefined if none found', async () => {
    const { globalDirectory } = await setupTest({
      createGlobalDir: true,
      rootAsCwd: true,
    });

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

    const { globalDirectory } = await setupTest({
      rawFiles: [
        { filename: 'myapp.config.yaml', content: '{}\n', layer: 'global' },
      ],
      createGlobalDir: true,
      formatPlugins: [yamlPlugin],
    });

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: globalDirectory },
      [yamlPlugin, jsonPlugin],
    );

    expect(result).toBe(path.resolve(globalDirectory, 'myapp.config.yaml'));
  });
});
