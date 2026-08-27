import path from 'node:path';

import {
  clearWatcherRegistry,
  createThrowingPlugin,
  setupTest,
} from '@oclio/test-helpers';

describe('plugin-architecture — core/plugin separation', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('custom plugin replacing json works without core calling JSON.parse', async () => {
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

    const { result } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.json', content: '{"port": 3000}' }],
      createGlobalDir: true,
      formatPlugins: [customJsonPlugin],
    });

    expect(wasParseCalled).toBe(true);
    expect(result!.config).toEqual({ port: 3000 });
  });

  it('plugin parse receives filePath argument', async () => {
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

    const { projectDirectory } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.json', content: '{"port": 3000}' }],
      createGlobalDir: true,
      formatPlugins: [customPlugin],
    });

    expect(receivedFilePath).toBe(
      path.resolve(projectDirectory, 'myapp.config.json'),
    );
  });

  it('plugin parse error wrapped in MorselError(EPARSE)', async () => {
    const throwingPlugin = createThrowingPlugin({
      throwOn: 'parse',
      errorMessage: 'unexpected token',
    });

    await expect(
      setupTest({
        rawFiles: [{ filename: 'myapp.config.json', content: '{invalid json' }],
        createGlobalDir: true,
        formatPlugins: [throwingPlugin],
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EPARSE',
    });
  });

  it('plugin parse error message preserved in MorselError', async () => {
    const throwingPlugin = createThrowingPlugin({
      throwOn: 'parse',
      errorMessage: 'custom parse failure message',
    });

    try {
      await setupTest({
        rawFiles: [{ filename: 'myapp.config.json', content: '{}' }],
        createGlobalDir: true,
        formatPlugins: [throwingPlugin],
      });
    } catch (error) {
      expect((error as Error).message).toContain(
        'custom parse failure message',
      );
    }
  });
});
