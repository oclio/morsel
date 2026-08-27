import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('extends-basic — basic extends resolution', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('A extends B → config = deepMerge(B, A), extendsPaths contains B', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(1);
    expect(projectLayer!.extendsPaths[0]).toContain('base.json');
  });

  it('A extends B extends C → merge = deepMerge(C, B, A), extendsPaths = [C, B]', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'c.json', {
      port: 9000,
      host: '0.0.0.0',
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './c.json',
      port: 8080,
      host: 'localhost',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './b.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: 'localhost', timeout: 5000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(2);
    expect(projectLayer!.extendsPaths[0]).toContain('c.json');
    expect(projectLayer!.extendsPaths[1]).toContain('b.json');
  });

  it('extends resolved from declaring file dir, not cwd', async () => {
    const { directory, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    const sharedDirectory = `${directory}/shared`;
    await mkdir(sharedDirectory, { recursive: true });

    await writeConfig(sharedDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: '../shared/base.json',
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
  });

  it('extends with absolute path resolves as-is', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    const absoluteBase = `${projectDirectory}/base.json`;
    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: absoluteBase,
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
  });

  it.each([
    ['number', 42],
    ['boolean', true],
    ['object', { nested: true }],
  ])(
    'extends with non-string value (%s) silently ignored',
    async (_label, value) => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
      });

      await writeConfig(projectDirectory, 'myapp.config.json', {
        extends: value,
        port: 3000,
      });

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(config).toEqual({ port: 3000 });
    },
  );

  it('extends array with non-string entries filtered out silently', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./base.json', 42, true, null],
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
  });
});
