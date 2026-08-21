import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-max-depth — chain > 10 levels', () => {
  clearWatcherRegistry();

  it('throws MorselError(ECYCLE) for chain > 10', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    for (let index = 11; index > 0; index--) {
      const entry: Record<string, unknown> = {
        port: index,
        ['extends']: `./f${index - 1}.json`,
      };
      await writeConfig(projectDirectory, `f${index}.json`, entry);
    }
    await writeConfig(projectDirectory, 'f0.json', { port: 0 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './f11.json',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'ECYCLE',
    });
  });
});
