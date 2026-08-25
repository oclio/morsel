import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { HookContext } from '@/hooks/types';
import { loadConfig, watchConfig } from '@/index';

describe('hooks-trigger-remerge — triggerRemerge', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('triggerRemerge: hook requests re-merge → config updates', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let triggerFunction: (() => void) | undefined;
    let callCount = 0;
    const hooks = [
      {
        name: 'trigger-hook',
        lifecycle: 'before:defaults' as const,
        load: (context: HookContext) => {
          callCount++;
          triggerFunction = context.triggerRemerge;
          return { call: callCount };
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(callCount).toBe(1);
    expect(store.config).toEqual({ call: 1, port: 3000 });

    triggerFunction!();
    await waitForRemerge(store, (config) => config['call'] === 2);

    expect(callCount).toBe(2);
    expect(store.config).toEqual({ call: 2, port: 3000 });

    await store.stop();
  });

  it('triggerRemerge noop in loadConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let isTriggerCalled = false;
    const hooks = [
      {
        name: 'trigger-hook',
        lifecycle: 'before:defaults' as const,
        load: (context: HookContext) => {
          context.triggerRemerge();
          isTriggerCalled = true;
          return { key: 'val' };
        },
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    expect(isTriggerCalled).toBe(true);
    expect(config).toEqual({ key: 'val', port: 3000 });
  });

  it('triggerRemerge coalesced via re-merge in-progress and pending flags', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let triggerFunction: (() => void) | undefined;
    let callCount = 0;
    const hooks = [
      {
        name: 'trigger-hook',
        lifecycle: 'before:defaults' as const,
        load: (context: HookContext) => {
          callCount++;
          triggerFunction = context.triggerRemerge;
          return { call: callCount };
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      watchDebounce: 100,
      hooks,
    });

    expect(callCount).toBe(1);

    triggerFunction!();
    triggerFunction!();
    triggerFunction!();

    await waitForRemerge(store, (config) => config['call'] === 3);

    expect(callCount).toBe(3);

    await store.stop();
  });
});
