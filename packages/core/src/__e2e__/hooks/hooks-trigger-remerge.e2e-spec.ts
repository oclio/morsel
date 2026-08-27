import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
} from '@oclio/morsel-test-helpers';

import type { HookContext } from '@/hooks/types';

describe('hooks-trigger-remerge — triggerRemerge', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('triggerRemerge: hook requests re-merge → config updates', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
    } as never);

    expect(callCount).toBe(1);
    expect(store!.config).toEqual({ call: 1, port: 3000 });

    triggerFunction!();
    await assertRemerge(store!, { call: 2, port: 3000 });

    expect(callCount).toBe(2);

    await store!.stop();
  });

  it('triggerRemerge noop in loadConfig', async () => {
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

    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    expect(isTriggerCalled).toBe(true);
    expect(result!.config).toEqual({ key: 'val', port: 3000 });
  });

  it('triggerRemerge coalesced via re-merge in-progress and pending flags', async () => {
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

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      watchDebounce: 100,
      hooks,
    } as never);

    expect(callCount).toBe(1);

    triggerFunction!();
    triggerFunction!();
    triggerFunction!();

    await waitForRemerge(store!, (config) => config['call'] === 3);

    expect(callCount).toBe(3);

    await store!.stop();
  });
});
