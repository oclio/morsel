import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-merge — merge behavior', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('nested objects are merged, not replaced', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 8080 },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { port: 3000, timeout: 5000 },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { server: { host: 'localhost', retries: 3 } },
    });

    expect(config).toEqual({
      server: { host: '0.0.0.0', port: 3000, timeout: 5000, retries: 3 },
    });
  });

  it('deep merge at arbitrary depth (4+ levels)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { b: { c: { e: 'project' } } },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { a: { b: { c: { d: 'defaults' } } } },
    });

    expect(config).toEqual({
      a: { b: { c: { d: 'defaults', e: 'project' } } },
    });
  });

  it('defaults < global < project < overrides priority', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 8080,
      host: 'global.example.com',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      timeout: 5000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000, retries: 3 },
      overrides: { port: 9000, debug: true },
    });

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      timeout: 5000,
      retries: 3,
      debug: true,
    });
  });

  it('null in a higher layer resets the key from lower layers', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global.example.com',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: null,
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { host: 'localhost', port: 4000, debug: true },
      overrides: { port: null },
    });

    expect(config).toEqual({ host: null, port: null, debug: true });
  });

  it.each([
    {
      name: 'defaults',
      defaults: { port: null },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'global',
      defaults: { port: 4000 },
      globalConfig: { port: null },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'project',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: null },
      overrides: {},
      expected: { port: null },
    },
    {
      name: 'overrides',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: { port: null },
      expected: { port: null },
    },
  ])(
    'null overwrites from $name layer',
    async ({ defaults, globalConfig, projectConfig, overrides, expected }) => {
      await writeConfig(globalDirectory, 'myapp.config.json', globalConfig);
      await writeConfig(projectDirectory, 'myapp.config.json', projectConfig);

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        defaults,
        overrides,
      });

      expect(config).toEqual(expected);
    },
  );

  it('undefined in overrides does not overwrite, but other override keys do', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global.example.com',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000, host: 'localhost', retries: 3 },
      overrides: { port: 9000, host: undefined, debug: true },
    });

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      retries: 3,
      debug: true,
    });
  });

  it.each([
    {
      name: 'defaults',
      defaults: { port: undefined },
      globalConfig: { port: 8080 },
      projectConfig: {},
      overrides: {},
      expected: { port: 8080 },
    },
    {
      name: 'global',
      defaults: { port: 4000 },
      globalConfig: { port: undefined },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'project',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: undefined },
      overrides: {},
      expected: { port: 8080 },
    },
    {
      name: 'overrides',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: { port: undefined },
      expected: { port: 3000 },
    },
  ])(
    'undefined ignored from $name layer',
    async ({ defaults, globalConfig, projectConfig, overrides, expected }) => {
      await writeConfig(globalDirectory, 'myapp.config.json', globalConfig);
      await writeConfig(projectDirectory, 'myapp.config.json', projectConfig);

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        defaults,
        overrides,
      });

      expect(config).toEqual(expected);
    },
  );

  it('object replaced by scalar — scalar wins', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: 'disabled',
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { server: { host: 'localhost' } },
    });

    expect(config).toEqual({ server: 'disabled' });
  });

  it('scalar replaced by object — object wins', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: { value: 3000 },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(config).toEqual({ port: { value: 3000 } });
  });

  it('scalar of different type — string wins over number', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(config).toEqual({ port: '3000' });
  });

  it('array replaced by object — object wins', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: { x: 1 },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: ['a'] },
    });

    expect(config).toEqual({ tags: { x: 1 } });
  });

  it('object replaced by array — array wins', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: ['a', 'b'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { server: { host: 'x' } },
    });

    expect(config).toEqual({ server: ['a', 'b'] });
  });

  it('array replaced by scalar — scalar wins', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: 'none',
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { tags: ['a'] },
    });

    expect(config).toEqual({ tags: 'none' });
  });

  it('key present in defaults only survives in final result', async () => {
    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000, retries: 3 },
    });

    expect(config).toEqual({ port: 3000, retries: 3 });
  });

  it('key present in all 4 layers with different values — overrides wins', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000 },
      overrides: { port: 9000 },
    });

    expect(config).toEqual({ port: 9000 });
  });
});
