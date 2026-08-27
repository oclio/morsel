import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-errors — ENOPLUGIN errors', () => {
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

  it('no plugin error via extends: .yaml without yaml plugin', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'base.yaml'),
      'port: 3000',
      'utf8',
    );
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.yaml',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });
  });

  it('project file with unsupported extension silently ignored (not discovered)', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.yaml'),
      'port: 3000',
      'utf8',
    );

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({});

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.exists).toBe(false);
  });

  it('hint message for .yaml includes generic instruction', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'base.yaml'),
      'port: 3000',
      'utf8',
    );
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.yaml',
    });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
      expect((error as Error).message).toContain('.yaml');
    }
  });

  it('hint message for unknown extension .xml includes generic instruction', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'base.xml'),
      '<config><port>3000</port></config>',
      'utf8',
    );
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.xml',
    });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
      expect((error as Error).message).toContain('.xml');
    }
  });

  it('hint message for file with no extension', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'plain'),
      'port: 3000',
      'utf8',
    );
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './plain',
    });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });
    } catch (error) {
      expect((error as Error).message).toContain('no extension');
      expect((error as Error).message).toContain('Register a FormatPlugin');
    }
  });

  it('empty formatPlugins array throws TypeError', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        formatPlugins: [],
      }),
    ).rejects.toThrow(TypeError);
  });

  it('empty formatPlugins error message contains expected content', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
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
