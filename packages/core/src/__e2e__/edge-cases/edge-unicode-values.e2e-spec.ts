import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-unicode-values — unicode/emoji in config values', () => {
  clearWatcherRegistry();

  it('unicode and emoji values preserved without corruption', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      name: 'café',
      emoji: '🚀',
      nested: { greeting: 'こんにちは' },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({
      name: 'café',
      emoji: '🚀',
      nested: { greeting: 'こんにちは' },
    });
  });
});
