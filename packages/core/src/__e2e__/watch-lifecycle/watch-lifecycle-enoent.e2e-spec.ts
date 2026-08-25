import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-enoent — ENOENT during re-merge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ENOENT during re-merge → short-circuited, config frozen', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      onDebug: () => {},
    });

    expect(store.config).toEqual({ port: 3000 });

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('onDebug called with { code: ENOENT, sources: [...] }', async () => {
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

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const enoentContext = debugContexts.find(
      (context) => context['code'] === 'ENOENT',
    );

    expect(enoentContext).toBeDefined();
    expect(enoentContext?.['sources']).toBeDefined();

    await store.stop();
  });

  it('enoentLogged suppresses duplicate ENOENT onDebug', async () => {
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

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const enoentCount = debugContexts.filter(
      (context) => context['code'] === 'ENOENT',
    ).length;

    expect(enoentCount).toBe(1);

    await store.stop();
  });

  it('enoentLogged cleared when all files reappear', async () => {
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

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const firstEnoentCount = debugContexts.filter(
      (context) => context['code'] === 'ENOENT',
    ).length;
    expect(firstEnoentCount).toBe(1);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    await rm(path.join(projectDirectory, 'myapp.config.json'));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const totalEnoentCount = debugContexts.filter(
      (context) => context['code'] === 'ENOENT',
    ).length;
    expect(totalEnoentCount).toBe(2);

    await store.stop();
  });
});
