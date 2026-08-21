import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-custom-parse — custom plugin parses factice format', () => {
  clearWatcherRegistry();

  it('custom plugin parses .ini-like format correctly', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.ini'),
      'port=3000\ndebug=true',
      'utf8',
    );

    const iniPlugin = {
      name: 'ini',
      extensions: ['.ini'],
      parse: (content: string) => {
        const result: Record<string, unknown> = {};
        for (const line of content.split('\n')) {
          const [key, value] = line.split('=', 2);
          if (key && value !== undefined) {
            const trimmedKey = key.trim();
            const trimmedValue = value.trim();
            let parsed: unknown;
            if (trimmedValue === 'true') {
              parsed = true;
            } else if (trimmedValue === 'false') {
              parsed = false;
            } else {
              parsed = Number(trimmedValue);
            }
            result[trimmedKey] = parsed;
          }
        }
        return result;
      },
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      formatPlugins: [iniPlugin],
    });

    expect(config).toEqual({ port: 3000, debug: true });
  });
});
