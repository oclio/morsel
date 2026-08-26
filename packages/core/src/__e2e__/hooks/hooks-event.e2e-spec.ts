import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { WriteEvent } from '@/hooks/types';
import { watchConfig } from '@/index';

describe('hooks-event — EventHook (after:write)', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('after:write called after successful mutation with WriteEvent', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.set('host', 'localhost');

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]!.keyPath).toBe('host');
    expect(receivedEvents[0]!.mutation.value).toBe('localhost');

    await store.stop();
  });

  it('after:write throws → caught, logged via onDebug, no rollback', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
      onDebug: callback,
    });

    await store.set('host', 'localhost');

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });
    expect(
      contexts.some((context) => context['hookName'] === 'failing-audit'),
    ).toBe(true);

    await store.stop();
  });

  it('after:write not called on write failure', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
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
    });

    await expect(store.set('host', 'localhost')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(eventCount).toBe(0);

    await store.stop();
  });

  it('after:write async: awaited', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.set('host', 'localhost');

    expect(isAsyncResolved).toBe(true);

    await store.stop();
  });

  it('multiple event hooks: all called in order', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.set('host', 'localhost');

    expect(callOrder).toEqual(['first', 'second']);

    await store.stop();
  });
});
