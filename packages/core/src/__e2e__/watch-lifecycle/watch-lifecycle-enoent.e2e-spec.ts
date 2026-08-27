import { rm } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForDebugContext,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-lifecycle-enoent — ENOENT during re-merge', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('ENOENT during re-merge → short-circuited, config frozen', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    expect(store!.config).toEqual({ port: 3000 });

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'ENOENT',
    );

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('onDebug called with { code: ENOENT, sources: [...] }', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'ENOENT',
    );

    const enoentContext = debugContexts.find(
      (context) => context['code'] === 'ENOENT',
    );

    expect(enoentContext).toBeDefined();
    expect(enoentContext?.['sources']).toBeDefined();

    await store!.stop();
  });

  it('enoentLogged suppresses duplicate ENOENT onDebug', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'ENOENT',
    );

    const enoentCount = debugContexts.filter(
      (context) => context['code'] === 'ENOENT',
    ).length;

    expect(enoentCount).toBe(1);

    await store!.stop();
  });

  it('enoentLogged cleared when all files reappear', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'ENOENT',
    );

    const firstEnoentCount = debugContexts.filter(
      (context) => context['code'] === 'ENOENT',
    ).length;
    expect(firstEnoentCount).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    debugContexts.length = 0;

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'ENOENT',
    );

    const totalEnoentCount =
      firstEnoentCount +
      debugContexts.filter((context) => context['code'] === 'ENOENT').length;
    expect(totalEnoentCount).toBe(2);

    await store!.stop();
  });
});
