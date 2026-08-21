import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-dotted-key-as-string — dotted key stays flat', () => {
  clearWatcherRegistry();

  it('"foo.bar" key is not split into nested object', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      'foo.bar': 123,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ 'foo.bar': 123 });
    expect(config).not.toHaveProperty('foo');
  });
});
