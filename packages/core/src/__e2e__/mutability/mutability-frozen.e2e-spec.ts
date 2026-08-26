import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-frozen — frozen mode (default)', () => {
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

  it('frozen default: Object.isFrozen(config) is true', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(Object.isFrozen(config)).toBe(true);
  });

  it('frozen nested: recursive freeze, nested objects frozen', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: true, prettier: false },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const tools = (config as Record<string, unknown>)['tools'];
    expect(Object.isFrozen(tools)).toBe(true);
  });

  it('frozen mutation throws: assigning property throws in strict mode', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(() => {
      (config as Record<string, unknown>)['foo'] = 'bar';
    }).toThrow();
  });

  it('frozen delete blocked → TypeError', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(() => {
      delete (config as Record<string, unknown>)['port'];
    }).toThrow();
  });

  it('frozen arrays frozen: arrays in config are also frozen', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: ['a', 'b', 'c'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const items = (config as Record<string, unknown>)['items'];
    expect(Array.isArray(items)).toBe(true);
    expect(Object.isFrozen(items)).toBe(true);
  });
});
