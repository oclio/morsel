import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-architecture — core/plugin separation', () => {
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

  it('custom plugin replacing json works without core calling JSON.parse', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

    let wasParseCalled = false;
    const customJsonPlugin = {
      name: 'custom-json',
      extensions: ['.json'],
      parse: (content: string) => {
        wasParseCalled = true;
        return JSON.parse(content) as Record<string, unknown>;
      },
      serialize: () => '',
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [customJsonPlugin],
    });

    expect(wasParseCalled).toBe(true);
    expect(config).toEqual({ port: 3000 });
  });

  it('plugin parse receives filePath argument', async () => {
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{"port": 3000}', 'utf8');

    let receivedFilePath: string | undefined;
    const customPlugin = {
      name: 'capturing-json',
      extensions: ['.json'],
      parse: (content: string, filePath?: string) => {
        receivedFilePath = filePath;
        return JSON.parse(content) as Record<string, unknown>;
      },
      serialize: () => '',
    };

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [customPlugin],
    });

    expect(receivedFilePath).toBe(configPath);
  });

  it('plugin parse error wrapped in MorselError(EPARSE)', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{invalid json',
      'utf8',
    );

    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: () => {
        throw new Error('unexpected token');
      },
      serialize: () => '',
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        formatPlugins: [throwingPlugin],
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EPARSE',
    });
  });

  it('plugin parse error message preserved in MorselError', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{}',
      'utf8',
    );

    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: () => {
        throw new Error('custom parse failure message');
      },
      serialize: () => '',
    };

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        formatPlugins: [throwingPlugin],
      });
    } catch (error) {
      expect((error as Error).message).toContain(
        'custom parse failure message',
      );
    }
  });
});
