import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('hooks-throw-remerge — hook throw on re-merge keeps config', () => {
  clearWatcherRegistry();

  it('hook throw on re-merge → catch, config kept, onDebug notified', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    let shouldThrow = false;
    const debugContexts: Record<string, unknown>[] = [];

    const hooks = [
      {
        name: 'conditional',
        lifecycle: 'before:defaults' as const,
        load: () => {
          if (shouldThrow) {
            throw new Error('re-merge boom');
          }
          return { hookKey: 'hook-value' };
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });

    shouldThrow = true;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store.config).toEqual({ hookKey: 'hook-value', port: 3000 });
    expect(debugContexts.some((context) => context['code'] === 'EHOOK')).toBe(
      true,
    );

    await store.stop();
  });
});
