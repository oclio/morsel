import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  morselPlugin,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-respects-existing-non-json — does not overwrite non-json config', () => {
  clearWatcherRegistry();

  it('existing .morsel file → initConfig returns its path without overwriting', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    const morselPath = path.resolve(projectDirectory, 'myapp.config.morsel');
    await writeFile(morselPath, 'port=3000', 'utf8');

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 9999 },
      formatPlugins: [morselPlugin],
    } as never);

    expect(result).toBe(morselPath);

    const content = readFileSync(morselPath, 'utf8');
    expect(content).toBe('port=3000');
  });
});
