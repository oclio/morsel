import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  assertRemerge,
  clearWatcherRegistry,
  createEventCollector,
  createThrowingPlugin,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import type { WriteEvent } from '@/hooks/types';

describe('mutations-set — set() API', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('set default target: optimistic update + disk write + event modified', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    const { events, listener } = createEventCollector();
    store!.on('port', listener);

    await store!.set('port', 8080);

    expect(store!.config).toEqual({ port: 8080 });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'port',
      type: 'modified',
      next: 8080,
      prev: 3000,
    });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('set target: global — write to global layer', async () => {
    const { store, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      globalConfig: { host: 'localhost' },
      watch: true,
    });

    await store!.set('host', 'example.com', 'global');

    expect(store!.config).toEqual({ port: 3000, host: 'example.com' });

    const content = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ host: 'example.com' });

    await store!.stop();
  });

  it('set target: project — explicit project target', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set('host', 'localhost', 'project');

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 3000, host: 'localhost' });

    await store!.stop();
  });

  it('set new key: event added, prev undefined', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    const { events, listener } = createEventCollector();
    store!.on('host', listener);

    await store!.set('host', 'localhost');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'host',
      type: 'added',
      next: 'localhost',
      prev: undefined,
    });

    await store!.stop();
  });

  it('set key in global + project with target: project — project wins after re-merge', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      globalConfig: { port: 4000 },
      watch: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await store!.set('port', 8080, 'project');

    expect(store!.config).toEqual({ port: 8080 });

    await assertRemerge(store!, { port: 8080 });

    await store!.stop();
  });

  it('set on dotted key that does not exist yet', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set('database.host', 'localhost');

    expect(store!.get('database.host')).toBe('localhost');
    expect(store!.get('database')).toEqual({ host: 'localhost' });

    await store!.stop();
  });

  it('set rollback on write failure: revert events emitted, MorselError(EWRITE) thrown', async () => {
    const throwingPlugin = createThrowingPlugin();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    const { events, listener } = createEventCollector();
    store!.on('port', listener);

    await expect(store!.set('port', 8080)).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store!.config).toEqual({ port: 3000 });

    const modifiedEvents = events.filter((event) => event.type === 'modified');
    const revertEvents = events.filter(
      (event) => event.type === 'modified' && event.next === 3000,
    );
    expect(modifiedEvents.length).toBeGreaterThanOrEqual(1);
    expect(revertEvents.length).toBeGreaterThanOrEqual(1);

    await store!.stop();
  });

  it('set triggers after:write hook with WriteEvent on success', async () => {
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
      hooks,
    });

    await store!.set('host', 'localhost');

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]!.keyPath).toBe('host');
    expect(receivedEvents[0]!.mutation.value).toBe('localhost');

    await store!.stop();
  });

  it('set on frozen config after stop: throws', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.stop();

    await expect(store!.set('port', 8080)).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('set on stopped store → Error(morsel: store is stopped)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.stop();

    await expect(store!.set('port', 8080)).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('set no writable file → Error(morsel: cannot write)', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      watch: true,
    });

    await expect(store!.set('port', 8080)).rejects.toThrow(
      'morsel: cannot write',
    );

    await store!.stop();
  });

  it('set fallback to projectPath if origin not writable', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      defaults: { host: 'localhost' },
      watch: true,
    });

    await store!.set('host', 'example.com');

    expect(store!.get('host')).toBe('example.com');

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['host']).toBe('example.com');

    await store!.stop();
  });

  it('set on non-existent file → file created', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    const projectFile = path.resolve(projectDirectory, 'myapp.config.json');
    await rm(projectFile);

    await store!.set('host', 'localhost');

    expect(existsSync(projectFile)).toBe(true);

    const content = JSON.parse(readFileSync(projectFile, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(content).toEqual({ host: 'localhost' });

    await store!.stop();
  });

  it('set reads existing file, parses, mutates, serializes', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
    });

    await store!.set('port', 8080);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080, host: 'localhost' });

    await store!.stop();
  });

  it('set atomic write: .tmp.<timestamp> then rename', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set('port', 8080);

    const files = readdirSync(projectDirectory);
    const temporaryFiles = files.filter((file) => file.includes('.tmp.'));
    expect(temporaryFiles).toHaveLength(0);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('set with array path', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set(['database', 'host'], 'localhost');

    expect(store!.get('database.host')).toBe('localhost');

    await store!.stop();
  });

  it('set triggers validation after optimistic update', async () => {
    const validationPlugin = {
      name: 'port-validator',
      validate: (config: Record<string, unknown>) => {
        if (config['port'] === 8080) {
          throw new Error('port 8080 is reserved');
        }
        return config;
      },
    };

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      validationPlugins: [validationPlugin],
    } as never);

    await expect(store!.set('port', 8080)).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });

  it('set triggers interpolation after merge', async () => {
    process.env['MORSEL_HOST'] = 'localhost';
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set('host', '${MORSEL_HOST}');

    expect(store!.get('host')).toBe('localhost');

    delete process.env['MORSEL_HOST'];
    await store!.stop();
  });

  it('set emits change events via emitChanges', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
    });

    const { events: portEvents, listener } = createEventCollector();
    store!.on('port', listener);

    await store!.set('port', 8080);

    expect(portEvents).toHaveLength(1);
    expect(portEvents[0]).toEqual({
      keyPath: 'port',
      type: 'modified',
      next: 8080,
      prev: 3000,
    });

    await store!.stop();
  });

  it('set rollback skips if concurrent re-merge changed config', async () => {
    const throwingPlugin = createThrowingPlugin();

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9999 });
    await waitForRemerge(store!, (config) => config['port'] === 9999);

    await expect(store!.set('port', 8080)).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store!.get('port')).toBe(9999);

    await store!.stop();
  });

  it('set rollback emits revert events', async () => {
    const throwingPlugin = createThrowingPlugin();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    const { events, listener } = createEventCollector();
    store!.on('port', listener);

    await expect(store!.set('port', 8080)).rejects.toThrow();

    const hasRevert = events.some(
      (event) => event.type === 'modified' && event.next === 3000,
    );
    expect(hasRevert).toBe(true);

    await store!.stop();
  });

  it('set triggers re-merge via fs.watch after write', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.set('port', 8080);

    await assertRemerge(store!, { port: 8080 });

    await store!.stop();
  });

  it('set on defaults/overrides layer → throws (no file path, not writable)', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      overrides: { host: 'localhost' },
      watch: true,
    });

    await expect(store!.set('port', 8080)).rejects.toThrow(
      'morsel: cannot write',
    );

    await store!.stop();
  });

  it('get/has reflect mutation after set', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    expect(store!.get('host')).toBeUndefined();
    expect(store!.has('host')).toBe(false);

    await store!.set('host', 'localhost');

    expect(store!.get('host')).toBe('localhost');
    expect(store!.has('host')).toBe(true);

    await store!.stop();
  });
});
