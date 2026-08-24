import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

import { setupPluginErrorScenario } from './_setup-plugin-error';

describe('plugin-hint-message — ENOPLUGIN message includes install hints', () => {
  clearWatcherRegistry();

  it('hint for .yaml includes generic instruction', async () => {
    const { directory, projectDirectory } = await setupPluginErrorScenario(
      'base.yaml',
      'port: 3000',
    );

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
    }
  });

  it('hint for unknown extension .xml includes generic instruction', async () => {
    const { directory, projectDirectory } = await setupPluginErrorScenario(
      'base.xml',
      '<config><port>3000</port></config>',
    );

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'NoPluginError',
      code: 'ENOPLUGIN',
    });

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      });
    } catch (error) {
      expect((error as Error).message).toContain('Register a FormatPlugin');
    }
  });
});
