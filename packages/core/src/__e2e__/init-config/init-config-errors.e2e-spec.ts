import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createThrowingPlugin,
  setupTest,
} from '@oclio/morsel-test-helpers';

import { initConfig } from '@/index';

describe('init-config-errors — error handling', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('serialize failure → MorselError(EWRITE) with path and cause', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    const throwingPlugin = createThrowingPlugin();

    expect(() =>
      initConfig({
        name: 'myapp',
        cwd: projectDirectory,
        content: { port: 3000 },
        formatPlugins: [throwingPlugin],
      } as never),
    ).toThrow(expect.objectContaining({ name: 'MorselError', code: 'EWRITE' }));
  });

  it('write failure → MorselError(EIO) with path and cause', async () => {
    const { directory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

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

  it('mkdirSync failure → MorselError(EIO)', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

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

  it('empty formatPlugins → TypeError', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

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
