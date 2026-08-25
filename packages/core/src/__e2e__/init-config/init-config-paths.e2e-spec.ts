import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-paths — path resolution', () => {
  let directory: string;
  let projectDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
  });

  it('custom extension: first format plugin extension used', () => {
    const morselPlugin = {
      name: 'morsel',
      extensions: ['.morsel'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) =>
        JSON.stringify(data, undefined, 2) + '\n',
    };

    const returnedPath = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
      formatPlugins: [morselPlugin],
    } as never);

    expect(returnedPath).toBe(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
    );

    const content = readFileSync(returnedPath, 'utf8');
    expect(JSON.parse(content)).toEqual({ port: 3000 });
  });

  it('.config/ directory convention: if .config/ exists → writes to .config/<name><ext>', async () => {
    const configDirectory = path.resolve(projectDirectory, '.config');
    await mkdir(configDirectory, { recursive: true });

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(configDirectory, 'myapp.json'));
    expect(existsSync(result)).toBe(true);
    expect(
      existsSync(path.resolve(projectDirectory, 'myapp.config.json')),
    ).toBe(false);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });

  it('.config/ directory with custom plugin → path becomes .config/<name><extension>', async () => {
    const configDirectory = path.resolve(projectDirectory, '.config');
    await mkdir(configDirectory, { recursive: true });

    const morselPlugin = {
      name: 'morsel',
      extensions: ['.morsel'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) =>
        JSON.stringify(data, undefined, 2) + '\n',
    };

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
      formatPlugins: [morselPlugin],
    } as never);

    expect(result).toBe(path.resolve(configDirectory, 'myapp.morsel'));
    expect(existsSync(result)).toBe(true);
  });

  it('plugin extension fallback: plugin with no extensions → defaults to .json', () => {
    const noExtensionPlugin = {
      name: 'no-ext',
      extensions: [],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) =>
        JSON.stringify(data, undefined, 2),
    };

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
      formatPlugins: [noExtensionPlugin],
    } as never);

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });
});
