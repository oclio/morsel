import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-test-helpers';

import type { WriteEvent } from '@/hooks/types';

describe('hooks-event — EventHook (after:write)', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('after:write called after successful mutation with WriteEvent', async () => {
    const receivedEvents: WriteEvent[] = [];
    const hooks = [
      {
        name: 'audit',
        lifecycle: 'after:write' as const,
        onWrite: (event: WriteEvent) => {
          receivedEvents.push(event);
        },
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
    } as never);

    await store!.set('host', 'localhost');

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]!.keyPath).toBe('host');
    expect(receivedEvents[0]!.mutation.value).toBe('localhost');

    await store!.stop();
  });

  it('after:write throws → caught, logged via onDebug, no rollback', async () => {
    const { contexts, callback } = createDebugCollector();

    const hooks = [
      {
        name: 'failing-audit',
        lifecycle: 'after:write' as const,
        onWrite: () => {
          throw new Error('audit boom');
        },
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
      onDebug: callback,
    } as never);

    await store!.set('host', 'localhost');

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });
    expect(
      contexts.some((context) => context['hookName'] === 'failing-audit'),
    ).toBe(true);

    await store!.stop();
  });

  it('after:write not called on write failure', async () => {
    let eventCount = 0;
    const hooks = [
      {
        name: 'audit',
        lifecycle: 'after:write' as const,
        onWrite: () => {
          eventCount++;
        },
      },
      {
        name: 'throwing-serialize',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      formatPlugins: [
        {
          name: 'throwing',
          extensions: ['.json'],
          parse: (content: string) =>
            JSON.parse(content) as Record<string, unknown>,
          serialize: () => {
            throw new Error('serialize failed');
          },
        },
      ],
      hooks,
    } as never);

    await expect(store!.set('host', 'localhost')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(eventCount).toBe(0);

    await store!.stop();
  });

  it('after:write async: awaited', async () => {
    let isAsyncResolved = false;
    const hooks = [
      {
        name: 'async-audit',
        lifecycle: 'after:write' as const,
        onWrite: () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              isAsyncResolved = true;
              resolve();
            }, 50);
          }),
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
    } as never);

    await store!.set('host', 'localhost');

    expect(isAsyncResolved).toBe(true);

    await store!.stop();
  });

  it('multiple event hooks: all called in order', async () => {
    const callOrder: string[] = [];
    const hooks = [
      {
        name: 'first-audit',
        lifecycle: 'after:write' as const,
        onWrite: () => {
          callOrder.push('first');
        },
      },
      {
        name: 'second-audit',
        lifecycle: 'after:write' as const,
        onWrite: () => {
          callOrder.push('second');
        },
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      hooks,
    } as never);

    await store!.set('host', 'localhost');

    expect(callOrder).toEqual(['first', 'second']);

    await store!.stop();
  });
});
