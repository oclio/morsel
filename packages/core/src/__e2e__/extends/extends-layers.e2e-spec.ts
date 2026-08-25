import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-layers — extends in non-project layers', () => {
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

  it('extends in defaults → silently stripped (no throw, no warn)', async () => {
    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { extends: './base.json', timeout: 5000 },
    });

    expect(config).toEqual({ port: 3000, timeout: 5000 });
    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('host');
  });

  it('extends in overrides → silently stripped', async () => {
    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      overrides: { extends: './base.json', timeout: 5000 },
    });

    expect(config).toEqual({ port: 3000, timeout: 5000 });
    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('host');
  });

  it('extends in global file → resolveExtends + cleanup applied', async () => {
    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      extends: '../project/base.json',
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', timeout: 5000 });
    expect(config).not.toHaveProperty('extends');
  });

  it('extends in hook output → silently stripped', async () => {
    await writeConfig(projectDirectory, 'base.json', { host: '0.0.0.0' });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'my-hook',
        lifecycle: 'before:defaults',
        load: () => ({ extends: './base.json', extra: 'hook-value' }),
      },
    ] as const;

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(config).toEqual({ port: 3000, extra: 'hook-value' });
    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('host');
  });
});
