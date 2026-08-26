import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { WriteEvent } from '@/hooks/types';
import { watchConfig } from '@/index';

describe('mutations-unset — unset() API', () => {
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

  it('unset default target (all): delete from all writable layers', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global-host',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const result = await store.unset('host');

    expect(result).toBe(true);
    expect(store.has('host')).toBe(false);

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

    await store.stop();
  });

  it('unset target: project — delete from project only', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global-host',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.unset('host', 'project');

    expect(store.get('host')).toBe('global-host');

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

    await store.stop();
  });

  it('unset target: global — delete from global only', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global-host',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.unset('host', 'global');

    expect(store.get('host')).toBe('localhost');

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['host']).toBeUndefined();

    await store.stop();
  });

  it('unset key in global + project with target: project — global reclaims via re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: 'project-host',
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global-host',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.get('host')).toBe('project-host');

    await store.unset('host', 'project');

    await waitForRemerge(store, (config) => config['host'] === 'global-host');

    expect(store.get('host')).toBe('global-host');

    await store.stop();
  });

  it('unset key absent from target layer: returns false, no state corruption', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const result = await store.unset('missing', 'project');

    expect(result).toBe(false);
    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('unset key absent from in-memory config: returns false without writing', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const result = await store.unset('missing');

    expect(result).toBe(false);
    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('unset rollback on write failure: revert events, MorselError thrown', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: () => {
        throw new Error('serialize failed');
      },
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [throwingPlugin],
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store.on('host', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await expect(store.unset('host')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store.get('host')).toBe('localhost');

    const hasRevert = events.some(
      (event) => event.type === 'added' && event.next === 'localhost',
    );
    expect(hasRevert).toBe(true);

    await store.stop();
  });

  it('unset triggers after:write hook with isDelete: true', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

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

    await store.unset('host');

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]!.keyPath).toBe('host');
    expect(receivedEvents[0]!.mutation.isDelete).toBe(true);

    await store.stop();
  });

  it('unset existing key: event removed, prev value', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store.on('host', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await store.unset('host');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'removed',
      next: undefined,
      prev: 'localhost',
    });

    await store.stop();
  });

  it('unset on stopped store → Error(morsel: store is stopped)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    await expect(store.unset('port')).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('unset target all iterates all writable layers', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'project-host',
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'global-host',
      debug: true,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.unset('host');

    expect(store.has('host')).toBe(false);

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

    await store.stop();
  });

  it('unset writes to each file in sequence', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { host: 'a' });
    await writeConfig(globalDirectory, 'myapp.config.json', { host: 'b' });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.unset('host');

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

    await store.stop();
  });

  it('unset rollback on partial write failure', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { host: 'a' });
    await writeConfig(globalDirectory, 'myapp.config.json', { host: 'b' });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [throwingPlugin],
    });

    await expect(store.unset('host')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    await store.stop();
  });

  it('unset already-written files NOT reverted on failure — eventual consistency restored on next re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { host: 'a' });
    await writeConfig(globalDirectory, 'myapp.config.json', { host: 'b' });

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

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [throwingPlugin],
    });

    await expect(store.unset('host')).rejects.toThrow();

    const globalFileContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalFileContent['host']).toBeUndefined();

    await store.stop();
  });

  it('unset returns Promise<boolean>', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const result = store.unset('host');
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(true);

    await store.stop();
  });
});
