import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

import { setupPluginErrorScenario } from './_setup-plugin-error';

describe('plugin-no-plugin-error — .yaml without yaml plugin throws ENOPLUGIN', () => {
  clearWatcherRegistry();

  it('MorselNoPluginError thrown when extends references .yaml with no yaml plugin', async () => {
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
      name: 'MorselNoPluginError',
      code: 'ENOPLUGIN',
    });
  });
});
