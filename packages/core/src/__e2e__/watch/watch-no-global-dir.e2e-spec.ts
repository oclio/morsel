import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-no-global-dir — global dir does not exist, watchConfig does not crash', () => {
  clearWatcherRegistry();

  it('boots without crashing when global dir is missing', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      defaults: { port: 3000, host: 'localhost' },
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    await store.stop();
  });

  it('detects project file changes even when global dir is missing', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      defaults: { port: 3000, host: 'localhost' },
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080, host: 'localhost' });

    await store.stop();
  });

  it('recovers and re-merges when global dir is created after boot', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = path.resolve(homedir(), '.config', 'otherapp');

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'otherapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'otherapp',
      cwd: projectDirectory,
      defaults: { port: 3000, host: 'localhost' },
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(globalDirectory, 'otherapp.config.json', {
      host: '0.0.0.0',
    });

    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(store.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await store.stop();
    await rm(globalDirectory, { recursive: true, force: true });
  });
});
