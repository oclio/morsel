import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-mutable — mutable mode', () => {
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

  it('mutable: config not frozen, can be mutated', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    expect(Object.isFrozen(config)).toBe(false);

    const mutable = config as Record<string, unknown>;
    mutable['port'] = 8080;
    expect(mutable['port']).toBe(8080);
  });

  it('mutable no Proxy: plain object, not a Proxy', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    expect(Object.getPrototypeOf(config)).toBe(Object.prototype);
  });

  it('mutable nested not frozen: nested objects are mutable', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      database: { host: 'localhost' },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    const database = (config as Record<string, unknown>)['database'];
    expect(Object.isFrozen(database)).toBe(false);

    const mutableDatabase = database as Record<string, unknown>;
    mutableDatabase['host'] = 'example.com';
    expect(mutableDatabase['host']).toBe('example.com');
  });
});
