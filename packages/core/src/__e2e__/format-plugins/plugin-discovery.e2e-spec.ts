import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  morselPlugin,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { jsonPlugin, loadConfig } from '@/index';

describe('plugin-discovery — plugin selection and discovery', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('no formatPlugins → jsonPlugin by default reads .json files', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('custom plugin parses .ini-like format correctly', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.ini'),
      'port=3000\ndebug=true',
      'utf8',
    );

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

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [iniPlugin],
    });

    expect(config).toEqual({ port: 3000, debug: true });
  });

  it('multi extension discovery: 2 plugins, extension-based discovery', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
      'port=3000',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config).toEqual({ port: 3000 });

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
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

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

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [pluginA, pluginB],
    });

    expect(config).toEqual({ source: 'A' });
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

    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.yaml'),
      'port: 3000',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [yamlPlugin],
    });

    expect(config).toEqual({ port: 3000 });

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
    await writeFile(
      path.resolve(projectDirectory, 'base.JSON'),
      '{"port": 3000}',
      'utf8',
    );
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.JSON',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        formatPlugins: [jsonPlugin],
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });
  });

  it('plugin discovery for global file with custom plugin', async () => {
    await writeFile(
      path.resolve(globalDirectory, 'myapp.config.morsel'),
      'port=8080',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config).toEqual({ port: 8080 });
  });

  it('plugin discovery for .config/ directory with custom plugin', async () => {
    const configDirectory = path.resolve(projectDirectory, '.config');
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      path.resolve(configDirectory, 'myapp.morsel'),
      'port=3000',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config).toEqual({ port: 3000 });
  });
});
