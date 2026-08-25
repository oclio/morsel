import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-errors — error handling', () => {
  let directory: string;
  let projectDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
  });

  it('serialize failure → MorselError(EWRITE) with path and cause', () => {
    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: () => {
        throw new Error('serialize failed');
      },
    };

    expect(() =>
      initConfig({
        name: 'myapp',
        cwd: projectDirectory,
        content: { port: 3000 },
        formatPlugins: [throwingPlugin],
      } as never),
    ).toThrow(expect.objectContaining({ name: 'MorselError', code: 'EWRITE' }));
  });

  it('write failure → MorselError(EIO) with path and cause', () => {
    const readOnlyDirectory = path.resolve(directory, 'readonly');
    mkdirSync(readOnlyDirectory, { recursive: true, mode: 0o444 });

    expect(() =>
      initConfig({
        name: 'myapp',
        cwd: readOnlyDirectory,
        content: { port: 3000 },
      }),
    ).toThrow(expect.objectContaining({ name: 'MorselError', code: 'EIO' }));
  });

  it('mkdirSync failure → MorselError(EIO)', () => {
    const fileBlocker = path.resolve(projectDirectory, 'blocker');
    writeFileSync(fileBlocker, 'not a directory', 'utf8');

    const impossiblePath = path.resolve(fileBlocker, 'subdir');

    expect(() =>
      initConfig({
        name: 'myapp',
        cwd: impossiblePath,
        content: { port: 3000 },
      }),
    ).toThrow(expect.objectContaining({ name: 'MorselError', code: 'EIO' }));
  });

  it('empty formatPlugins → TypeError', () => {
    expect(() =>
      initConfig({
        name: 'myapp',
        cwd: projectDirectory,
        content: { port: 3000 },
        formatPlugins: [],
      } as never),
    ).toThrow(TypeError);
  });
});
