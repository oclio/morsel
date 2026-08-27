import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createEventCollector,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
} from '@oclio/morsel-e2e-helpers';

import type { WriteEvent } from '@/hooks/types';

describe('mutations-unset — unset() API', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('unset default target (all): delete from all writable layers', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      globalConfig: { host: 'global-host' },
      watch: true,
    });

    const result = await store!.unset('host');

    expect(result).toBe(true);
    expect(store!.has('host')).toBe(false);

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent['host']).toBeUndefined();

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['host']).toBeUndefined();

    await store!.stop();
  });

  it('unset target: project — delete from project only', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      globalConfig: { host: 'global-host' },
      watch: true,
    });

    await store!.unset('host', 'project');

    expect(store!.get('host')).toBe('global-host');

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent['host']).toBeUndefined();

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['host']).toBe('global-host');

    await store!.stop();
  });

  it('unset target: global — delete from global only', async () => {
    const { store, globalDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      globalConfig: { host: 'global-host' },
      watch: true,
    });

    await store!.unset('host', 'global');

    expect(store!.get('host')).toBe('localhost');

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['host']).toBeUndefined();

    await store!.stop();
  });

  it('unset key in global + project with target: project — global reclaims via re-merge', async () => {
    const { store } = await setupTest({
      projectConfig: { host: 'project-host' },
      globalConfig: { host: 'global-host' },
      watch: true,
    });

    expect(store!.get('host')).toBe('project-host');

    await store!.unset('host', 'project');

    await waitForRemerge(store!, (config) => config['host'] === 'global-host');

    expect(store!.get('host')).toBe('global-host');

    await store!.stop();
  });

  it('unset key absent from target layer: returns false, no state corruption', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    const result = await store!.unset('missing', 'project');

    expect(result).toBe(false);
    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('unset key absent from in-memory config: returns false without writing', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    const result = await store!.unset('missing');

    expect(result).toBe(false);
    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('unset rollback on write failure: revert events, MorselError thrown', async () => {
    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: () => {
        throw new Error('serialize failed');
      },
    };

    const { store } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    const { events, listener } = createEventCollector();
    store!.on('host', listener);

    await expect(store!.unset('host')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store!.get('host')).toBe('localhost');

    const hasRevert = events.some(
      (event) => event.type === 'added' && event.next === 'localhost',
    );
    expect(hasRevert).toBe(true);

    await store!.stop();
  });

  it('unset triggers after:write hook with isDelete: true', async () => {
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
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
      hooks,
    });

    await store!.unset('host');

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]!.keyPath).toBe('host');
    expect(receivedEvents[0]!.mutation.isDelete).toBe(true);

    await store!.stop();
  });

  it('unset existing key: event removed, prev value', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
    });

    const { events, listener } = createEventCollector();
    store!.on('host', listener);

    await store!.unset('host');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'host',
      type: 'removed',
      next: undefined,
      prev: 'localhost',
    });

    await store!.stop();
  });

  it('unset on stopped store → Error(morsel: store is stopped)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.stop();

    await expect(store!.unset('port')).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('unset target all iterates all writable layers', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'project-host' },
      globalConfig: { host: 'global-host', debug: true },
      watch: true,
    });

    await store!.unset('host');

    expect(store!.has('host')).toBe(false);

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent['host']).toBeUndefined();

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['host']).toBeUndefined();
    expect(globalContent['debug']).toBe(true);

    await store!.stop();
  });

  it('unset writes to each file in sequence', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { host: 'a' },
      globalConfig: { host: 'b' },
      watch: true,
    });

    await store!.unset('host');

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent['host']).toBeUndefined();
    expect(globalContent['host']).toBeUndefined();

    await store!.stop();
  });

  it('unset rollback on partial write failure', async () => {
    let serializeCallCount = 0;
    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: () => {
        serializeCallCount++;
        if (serializeCallCount >= 2) {
          throw new Error('serialize failed on second file');
        }
        return '{}';
      },
    };

    const { store } = await setupTest({
      projectConfig: { host: 'a' },
      globalConfig: { host: 'b' },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    await expect(store!.unset('host')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    await store!.stop();
  });

  it('unset already-written files NOT reverted on failure — eventual consistency restored on next re-merge', async () => {
    let serializeCallCount = 0;
    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) => {
        serializeCallCount++;
        if (serializeCallCount >= 2) {
          throw new Error('serialize failed on second file');
        }
        return `${JSON.stringify(data, undefined, 2)}\n`;
      },
    };

    const { store, globalDirectory } = await setupTest({
      projectConfig: { host: 'a' },
      globalConfig: { host: 'b' },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    await expect(store!.unset('host')).rejects.toThrow();

    const globalFileContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalFileContent['host']).toBeUndefined();

    await store!.stop();
  });

  it('unset returns Promise<boolean>', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
    });

    const result = store!.unset('host');
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(true);

    await store!.stop();
  });
});
