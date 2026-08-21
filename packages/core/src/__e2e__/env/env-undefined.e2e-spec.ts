import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-undefined — $env present but envName undefined', () => {
  clearWatcherRegistry();

  it('ignores $env block and warns onDebug', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];

    try {
      const { directory } = await createTemporaryEnvironment();
      const projectDirectory = `${directory}/project`;

      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 3000,
        $env: {
          ci: { port: 8080 },
        },
      });

      const debugMessages: string[] = [];

      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        onDebug: (message: string) => {
          debugMessages.push(message);
        },
      });

      expect(config).toEqual({ port: 3000 });
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
