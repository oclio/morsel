import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig, watchConfig } from '@/index';

describe('extends-live-reload — watch + extends', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('missing file: B created after boot → re-merge includes B', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });

    await assertRemerge(store, { port: 3000, host: '0.0.0.0' });

    await store.stop();
  });

  it('added: adding extends to A triggers re-merge', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    await assertRemerge(store, { port: 3000, host: '0.0.0.0' });

    await store.stop();
  });

  it('removed: removing extends from A drops B', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    await waitForRemerge(store, (config) => !('host' in config));

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('mutation: editing B triggers re-merge', async () => {
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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '127.0.0.1',
    });

    await assertRemerge(store, { port: 3000, host: '127.0.0.1' });

    await store.stop();
  });

  it('missing file at boot: A extends B (B missing) → exists:false, extendsPaths set, config = A only', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './missing.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(1);
    expect(projectLayer!.extendsPaths[0]).toContain('missing.json');
  });

  it('missing file in middle of chain: A extends B extends C (C missing) → B merged, C = exists:false', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    await writeConfig(projectDirectory, 'b.json', {
      extends: './missing.json',
      host: '0.0.0.0',
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

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(2);
    expect(projectLayer!.extendsPaths[0]).toContain('missing.json');
    expect(projectLayer!.extendsPaths[1]).toContain('b.json');
  });
});
