import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  morselPlugin,
  setupTest,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import { jsonPlugin, loadConfig } from '@/index';

describe('plugin-discovery — plugin selection and discovery', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('no formatPlugins → jsonPlugin by default reads .json files', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('custom plugin parses .ini-like format correctly', async () => {
    const iniPlugin = {
      name: 'ini',
      extensions: ['.ini'],
      parse: (content: string) => {
        const result: Record<string, unknown> = {};
        for (const line of content.split('\n')) {
          const [key, value] = line.split('=', 2);
          if (key && value !== undefined) {
            const trimmedKey = key.trim();
            const trimmedValue = value.trim();
            let parsed: unknown;
            if (trimmedValue === 'true') {
              parsed = true;
            } else if (trimmedValue === 'false') {
              parsed = false;
            } else {
              parsed = Number(trimmedValue);
            }
            result[trimmedKey] = parsed;
          }
        }
        return result;
      },
      serialize: () => '',
    };

    const { result } = await setupTest({
      rawFiles: [
        { filename: 'myapp.config.ini', content: 'port=3000\ndebug=true' },
      ],
      createGlobalDir: true,
      formatPlugins: [iniPlugin],
    });

    expect(result!.config).toEqual({ port: 3000, debug: true });
  });

  it('multi extension discovery: 2 plugins, extension-based discovery', async () => {
    const { projectDirectory, globalDirectory, result } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.morsel', content: 'port=3000' }],
      createGlobalDir: true,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(result!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    const { config: config2 } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config2).toEqual({ port: 3000 });
  });

  it('order priority: first plugin in array wins for same extension', async () => {
    const pluginA = {
      name: 'plugin-a',
      extensions: ['.json'],
      parse: () => ({ source: 'A' }),
      serialize: () => '',
    };

    const pluginB = {
      name: 'plugin-b',
      extensions: ['.json'],
      parse: () => ({ source: 'B' }),
      serialize: () => '',
    };

    const { result } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.json', content: '{"port": 3000}' }],
      createGlobalDir: true,
      formatPlugins: [pluginA, pluginB],
    });

    expect(result!.config).toEqual({ source: 'A' });
  });

  it('plugin with multiple extensions (.yaml, .yml) matches both', async () => {
    const yamlPlugin = {
      name: 'yaml',
      extensions: ['.yaml', '.yml'],
      parse: (content: string) => {
        const result: Record<string, unknown> = {};
        for (const line of content.split('\n')) {
          const [key, value] = line.split(':', 2);
          if (key && value !== undefined) {
            result[key.trim()] = Number(value.trim());
          }
        }
        return result;
      },
      serialize: () => '',
    };

    const { projectDirectory, globalDirectory, result } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.yaml', content: 'port: 3000' }],
      createGlobalDir: true,
      formatPlugins: [yamlPlugin],
    });

    expect(result!.config).toEqual({ port: 3000 });

    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.yml'),
      'port: 8080',
      'utf8',
    );
    await unlink(path.resolve(projectDirectory, 'myapp.config.yaml'));

    const { config: config2 } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [yamlPlugin],
    });

    expect(config2).toEqual({ port: 8080 });
  });

  it('case-sensitive extension match: .JSON does not match .json', async () => {
    await expect(
      setupTest({
        rawFiles: [{ filename: 'base.JSON', content: '{"port": 3000}' }],
        projectConfig: { extends: './base.JSON' },
        createGlobalDir: true,
        formatPlugins: [jsonPlugin],
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });
  });

  it('plugin discovery for global file with custom plugin', async () => {
    const { result } = await setupTest({
      rawFiles: [
        {
          filename: 'myapp.config.morsel',
          content: 'port=8080',
          layer: 'global',
        },
      ],
      createGlobalDir: true,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(result!.config).toEqual({ port: 8080 });
  });

  it('plugin discovery for .config/ directory with custom plugin', async () => {
    const { result } = await setupTest({
      rawFiles: [{ filename: '.config/myapp.morsel', content: 'port=3000' }],
      createGlobalDir: true,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(result!.config).toEqual({ port: 3000 });
  });
});
