import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-envname-undefined — NODE_ENV unset and no envName', () => {
  clearWatcherRegistry();

  it('ignores $env block and warns onDebug', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];

    const debugMessages: string[] = [];

    try {
      const { directory } = await createTemporaryEnvironment();

      await writeConfig(directory, 'myapp.config.json', {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      });

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: directory,
        globalDir: `${directory}/global`,
        onDebug: (message: string) => {
          debugMessages.push(message);
        },
      });

      expect(config).toEqual({ port: 3000 });
      expect(debugMessages.length).toBeGreaterThan(0);
      expect(debugMessages.some((message) => message.includes('$env'))).toBe(
        true,
      );
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
