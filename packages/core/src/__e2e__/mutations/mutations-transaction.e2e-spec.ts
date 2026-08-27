import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { WriteEvent } from '@/hooks/types';
import { watchConfig } from '@/index';

describe('mutations-transaction — store.transaction()', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  suppressConsoleError();

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      // Ignore — directory may not exist
    }
  });

  it('multi-key transaction on project: 1 write, correct final config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
      await store.set('host', '0.0.0.0');
    });

    expect(store.config).toEqual({ port: 8080, host: '0.0.0.0' });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080, host: '0.0.0.0' });

    await store.stop();
  });

  it('rollback on error: 0 files modified on disk, config intact', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(
      store.transaction(async () => {
        await store.set('port', 8080);
        throw new Error('something went wrong');
      }),
    ).rejects.toThrow('something went wrong');

    expect(store.config).toEqual({ port: 3000 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 3000 });

    await store.stop();
  });

  it('events emitted after commit', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; keyPath: string }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'modified', keyPath: 'port' });

    await store.stop();
  });

  it('no events on rollback', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; keyPath: string }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await expect(
      store.transaction(async () => {
        await store.set('port', 8080);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(events).toHaveLength(0);

    await store.stop();
  });

  it('empty transaction: noop, no error', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {});

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });

  it('transaction with unset: delete key atomically', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
      await store.unset('host');
    });

    expect(store.config).toEqual({ port: 8080 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080 });

    await store.stop();
  });

  it('nested transaction throws', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(
      store.transaction(async () => {
        await store.transaction(async () => {});
      }),
    ).rejects.toThrow('nested transactions');

    await store.stop();
  });

  it('transaction after stop throws', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    await expect(store.transaction(async () => {})).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('transaction with target:all writes to all layers', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.unset('port', 'all');
      await store.unset('host', 'all');
    });

    expect(store.config).toEqual({});

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent).toEqual({});

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent).toEqual({});

    await store.stop();
  });

  it('get during transaction sees in-progress state', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    let seenPort: unknown;
    await store.transaction(async () => {
      await store.set('port', 8080);
      seenPort = store.get('port');
    });

    expect(seenPort).toBe(8080);

    await store.stop();
  });

  it('queue:false mode: transaction still works', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      queue: false,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
    });

    expect(store.config).toEqual({ port: 8080 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080 });

    await store.stop();
  });

  it('headless mode: transaction still emits events', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      watch: false,
      proxy: false,
      queue: false,
    });

    const events: { type: string; keyPath: string }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'modified', keyPath: 'port' });

    await store.stop();
  });

  it('50 mutations in transaction: 1 write to disk', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: [],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      for (let index = 0; index < 50; index++) {
        await store.push('items', `item-${index}`);
      }
    });

    const items = store.get<string[]>('items');
    expect(items).toHaveLength(50);
    expect(items[0]).toBe('item-0');
    expect(items[49]).toBe('item-49');

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const diskItems = content['items'] as string[];
    expect(diskItems).toHaveLength(50);

    await store.stop();
  });

  it('multi-file transaction with set: writes to both project and global', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
      await store.set('host', '0.0.0.0', 'global');
    });

    expect(store.config).toEqual({ port: 8080, host: '0.0.0.0' });

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent).toEqual({ port: 8080 });

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent).toEqual({ host: '0.0.0.0' });

    await store.stop();
  });

  it('50 mutations on same file: exactly 1 write to disk', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: [],
    });

    const writeEvents: WriteEvent[] = [];
    const hooks = [
      {
        name: 'counter',
        lifecycle: 'after:write' as const,
        onWrite: (event: WriteEvent) => {
          writeEvents.push(event);
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.transaction(async () => {
      for (let index = 0; index < 50; index++) {
        await store.push('items', `item-${index}`);
      }
    });

    expect(writeEvents).toHaveLength(1);
    expect(writeEvents[0]!.filePath).toBe(
      path.resolve(projectDirectory, 'myapp.config.json'),
    );

    await store.stop();
  });

  it('debounce blocked during transaction: no partial re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; keyPath: string }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 9999,
      });
    });

    await waitForRemerge(store, (config) => config['port'] === 8080);

    expect(events.length).toBeLessThanOrEqual(1);

    await store.stop();
  });

  it('transaction with splice, pop, shift, unshift: atomic write', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b', 'c', 'd', 'e'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.splice('tags', 1, 2, 'x'); // ['a', 'x', 'd', 'e']
      await store.pop('tags'); // ['a', 'x', 'd']
      await store.shift('tags'); // ['x', 'd']
      await store.unshift('tags', 'z'); // ['z', 'x', 'd']
    });

    expect(store.get('tags')).toEqual(['z', 'x', 'd']);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['tags']).toEqual(['z', 'x', 'd']);

    await store.stop();
  });

  it('after:write hooks fire per written file after commit', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const writeEvents: WriteEvent[] = [];
    const hooks = [
      {
        name: 'audit',
        lifecycle: 'after:write' as const,
        onWrite: (event: WriteEvent) => {
          writeEvents.push(event);
        },
      },
    ];

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
      await store.set('host', '0.0.0.0', 'global');
    });

    expect(writeEvents).toHaveLength(2);
    const filePaths = writeEvents.map((event) => event.filePath);
    expect(filePaths).toContain(
      path.resolve(projectDirectory, 'myapp.config.json'),
    );
    expect(filePaths).toContain(
      path.resolve(globalDirectory, 'myapp.config.json'),
    );

    await store.stop();
  });

  it('cleans up .bak files after successful commit', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
    });

    const files = await readdir(projectDirectory);
    const bakFiles = files.filter((f) => f.endsWith('.bak'));
    expect(bakFiles).toEqual([]);

    await store.stop();
  });

  it('re-merge after commit does not re-emit events', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; keyPath: string }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await store.transaction(async () => {
      await store.set('port', 8080);
    });

    expect(events).toHaveLength(1);

    await waitForRemerge(store, (config) => config['port'] === 8080);
    expect(events).toHaveLength(1);

    await store.stop();
  });

  it('transaction with explicit target:project and target:global', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.transaction(async () => {
      await store.set('port', 8080, 'project');
      await store.set('host', '0.0.0.0', 'global');
    });

    expect(store.config).toEqual({ port: 8080, host: '0.0.0.0' });

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent).toEqual({ port: 8080 });

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent).toEqual({ host: '0.0.0.0' });

    await store.stop();
  });
});
