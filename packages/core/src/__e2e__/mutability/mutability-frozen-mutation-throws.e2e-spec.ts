import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-frozen-mutation-throws — mutation throws in strict mode', () => {
  clearWatcherRegistry();

  it('assigning a property on frozen config throws', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(() => {
      (config as Record<string, unknown>)['foo'] = 'bar';
    }).toThrow();
  });
});
