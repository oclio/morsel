import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-array — array extends', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('extends [B, C] → merge in array order', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'b.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'c.json', {
      port: 9000,
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b.json', './c.json'],
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', timeout: 5000 });
  });

  it('extends [B, C] → extendsPaths contains both resolved paths', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'b.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'c.json', { timeout: 5000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b.json', './c.json'],
      port: 3000,
    });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(2);
    expect(projectLayer!.extendsPaths[0]).toContain('b.json');
    expect(projectLayer!.extendsPaths[1]).toContain('c.json');
  });

  it('extends [B, missing] → B merged, missing = exists:false', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'b.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b.json', './missing.json'],
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
    expect(projectLayer!.extendsPaths).toHaveLength(2);
    expect(projectLayer!.extendsPaths[1]).toContain('missing.json');
  });

  it('extends array with duplicate paths → extendsPaths deduplicated via Set', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./base.json', './base.json'],
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
  });

  it('extends array with same file in two branches → not a cycle (visited is per-branch)', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'shared.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'b1.json', {
      extends: './shared.json',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'b2.json', {
      extends: './shared.json',
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b1.json', './b2.json'],
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', timeout: 5000 });
  });

  it('extends array with key conflicts between parents → last parent wins for shared keys', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'b.json', {
      host: 'b-host',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'c.json', {
      host: 'c-host',
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b.json', './c.json'],
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config['host']).toBe('c-host');
    expect(config['port']).toBe(3000);
    expect(config['timeout']).toBe(5000);
  });
});
