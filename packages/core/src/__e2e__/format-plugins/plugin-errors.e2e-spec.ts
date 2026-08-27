import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

describe('plugin-errors — ENOPLUGIN errors', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('no plugin error via extends: .yaml without yaml plugin', async () => {
    await expect(
      setupTest({
        rawFiles: [{ filename: 'base.yaml', content: 'port: 3000' }],
        projectConfig: { extends: './base.yaml' },
        createGlobalDir: true,
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });
  });

  it('project file with unsupported extension silently ignored (not discovered)', async () => {
    const { result } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.yaml', content: 'port: 3000' }],
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({});

    const projectLayer = result!.layers.find(
      (layer) => layer.source === 'project',
    );
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.exists).toBe(false);
  });

  it('hint message for .yaml includes generic instruction', async () => {
    try {
      await setupTest({
        rawFiles: [{ filename: 'base.yaml', content: 'port: 3000' }],
        projectConfig: { extends: './base.yaml' },
        createGlobalDir: true,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
      expect((error as Error).message).toContain('.yaml');
    }
  });

  it('hint message for unknown extension .xml includes generic instruction', async () => {
    try {
      await setupTest({
        rawFiles: [
          {
            filename: 'base.xml',
            content: '<config><port>3000</port></config>',
          },
        ],
        projectConfig: { extends: './base.xml' },
        createGlobalDir: true,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
      expect((error as Error).message).toContain('.xml');
    }
  });

  it('hint message for file with no extension', async () => {
    try {
      await setupTest({
        rawFiles: [{ filename: 'plain', content: 'port: 3000' }],
        projectConfig: { extends: './plain' },
        createGlobalDir: true,
      });
    } catch (error) {
      expect((error as Error).message).toContain('no extension');
      expect((error as Error).message).toContain('Register a FormatPlugin');
    }
  });

  it('empty formatPlugins array throws TypeError', async () => {
    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        formatPlugins: [],
      }),
    ).rejects.toThrow(TypeError);
  });

  it('empty formatPlugins error message contains expected content', async () => {
    try {
      await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
        formatPlugins: [],
      });
    } catch (error) {
      expect((error as Error).message).toContain('formatPlugins');
      expect((error as Error).message).toContain('empty');
    }
  });

  it('re-merge to .yaml extends → config preserved, no crash', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: callback,
    });

    await writeFile(
      path.resolve(projectDirectory, 'base.yaml'),
      'port: 9999',
      'utf8',
    );

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.yaml',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'ENOPLUGIN')).toBe(
      true,
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
