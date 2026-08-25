import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutations-mutability — interaction with configMutability', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('set with configMutability: mutable — lastConfig is a clone', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    await store.set('port', 8080);

    expect(store.config).toEqual({ port: 8080 });

    const mutable = store.config as Record<string, unknown>;
    mutable['port'] = 9999;

    expect(store.config).toEqual({ port: 9999 });

    await store.stop();
  });

  it('set with configMutability: frozen — lastConfig is same reference', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'frozen',
    });

    const referenceBefore = store.config;

    await store.set('port', 8080);

    expect(store.config).toEqual({ port: 8080 });

    const referenceAfter = store.config;
    expect(referenceBefore).toBe(referenceAfter);

    await store.stop();
  });
});
