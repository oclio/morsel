import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('extends-layers — extends in non-project layers', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('extends in defaults → silently stripped (no throw, no warn)', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

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
