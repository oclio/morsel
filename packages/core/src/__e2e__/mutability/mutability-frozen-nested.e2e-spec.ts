import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-frozen-nested — recursive freeze', () => {
  clearWatcherRegistry();

  it('nested objects are also frozen', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: true, prettier: false },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    const tools = (config as Record<string, unknown>)['tools'];
    expect(Object.isFrozen(tools)).toBe(true);
  });
});
