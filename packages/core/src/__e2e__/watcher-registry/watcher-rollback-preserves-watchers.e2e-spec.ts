import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-rollback-preserves-watchers — failed re-merge keeps watchers', () => {
  clearWatcherRegistry();

  it('parse error does not release watchers, onDebug notified with EPARSE, recovery works after fix', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const debugContexts: Record<string, unknown>[] = [];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid', 'utf8');

    const deadline = Date.now() + 5000;
    while (
      debugContexts.every((context) => context['code'] !== 'EPARSE') &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(store.config).toEqual({ port: 3000 });
    expect(debugContexts.some((context) => context['code'] === 'EPARSE')).toBe(
      true,
    );

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });
});
