import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('mutations-set — set() API', () => {
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

  it('set default target: optimistic update + disk write + event modified', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store.on('port', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await store.set('port', 8080);

    expect(store.config).toEqual({ port: 8080 });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'modified', next: 8080, prev: 3000 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080 });

    await store.stop();
  });

  it('set target: global — write to global layer', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('host', 'example.com', 'global');

    expect(store.config).toEqual({ port: 3000, host: 'example.com' });

    const content = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ host: 'example.com' });

    await store.stop();
  });

  it('set target: project — explicit project target', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('host', 'localhost', 'project');

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 3000, host: 'localhost' });

    await store.stop();
  });

  it('set new key: event added, prev undefined', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store.on('host', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await store.set('host', 'localhost');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'added',
      next: 'localhost',
      prev: undefined,
    });

    await store.stop();
  });

  it('set key in global + project with target: project — project wins after re-merge', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await writeConfig(globalDirectory, 'myapp.config.json', { port: 4000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.config).toEqual({ port: 3000 });

    await store.set('port', 8080, 'project');

    expect(store.config).toEqual({ port: 8080 });

    await waitForRemerge(store, (config) => config['port'] === 8080);

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });

  it('set on dotted key that does not exist yet', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('database.host', 'localhost');

    expect(store.get('database.host')).toBe('localhost');
    expect(store.get('database')).toEqual({ host: 'localhost' });

    await store.stop();
  });

  it('set rollback on write failure: revert events emitted, MorselError(EWRITE) thrown', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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
    store.on('port', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await expect(store.set('port', 8080)).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store.config).toEqual({ port: 3000 });

    const modifiedEvents = events.filter((event) => event.type === 'modified');
    const revertEvents = events.filter(
      (event) => event.type === 'modified' && event.next === 3000,
    );
    expect(modifiedEvents.length).toBeGreaterThanOrEqual(1);
    expect(revertEvents.length).toBeGreaterThanOrEqual(1);

    await store.stop();
  });

  it('set triggers after:write hook with WriteEvent on success', async () => {
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

  it('set on frozen config after stop: throws', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    await expect(store.set('port', 8080)).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('set on stopped store → Error(morsel: store is stopped)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    await expect(store.set('port', 8080)).rejects.toThrow(
      'morsel: store is stopped',
    );
  });

  it('set no writable file → Error(morsel: cannot write)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    await expect(store.set('port', 8080)).rejects.toThrow(
      'morsel: cannot write',
    );

    await store.stop();
  });

  it('set fallback to projectPath if origin not writable', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { host: 'localhost' },
    });

    await store.set('host', 'example.com');

    expect(store.get('host')).toBe('example.com');

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['host']).toBe('example.com');

    await store.stop();
  });

  it('set on non-existent file → file created', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const projectFile = path.resolve(projectDirectory, 'myapp.config.json');
    await rm(projectFile);

    await store.set('host', 'localhost');

    expect(existsSync(projectFile)).toBe(true);

    const content = JSON.parse(readFileSync(projectFile, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(content).toEqual({ host: 'localhost' });

    await store.stop();
  });

  it('set reads existing file, parses, mutates, serializes', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000, "host": "localhost"}',
      'utf8',
    );

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('port', 8080);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 8080, host: 'localhost' });

    await store.stop();
  });

  it('set atomic write: .tmp.<timestamp> then rename', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('port', 8080);

    const files = readdirSync(projectDirectory);
    const temporaryFiles = files.filter((file) => file.includes('.tmp.'));
    expect(temporaryFiles).toHaveLength(0);

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });

  it('set with array path', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set(['database', 'host'], 'localhost');

    expect(store.get('database.host')).toBe('localhost');

    await store.stop();
  });

  it('set triggers validation after optimistic update', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validationPlugin = {
      name: 'port-validator',
      validate: (config: Record<string, unknown>) => {
        if (config['port'] === 8080) {
          throw new Error('port 8080 is reserved');
        }
        return config;
      },
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [validationPlugin],
    } as never);

    await expect(store.set('port', 8080)).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });

    await store.stop();
  });

  it('set triggers interpolation after merge', async () => {
    process.env['MORSEL_HOST'] = 'localhost';
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('host', '${MORSEL_HOST}');

    expect(store.get('host')).toBe('localhost');

    delete process.env['MORSEL_HOST'];
    await store.stop();
  });

  it('set emits change events via emitChanges', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const portEvents: { type: string; next: unknown; prev: unknown }[] = [];
    store.on('port', (event) => {
      portEvents.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await store.set('port', 8080);

    expect(portEvents).toHaveLength(1);
    expect(portEvents[0]).toEqual({ type: 'modified', next: 8080, prev: 3000 });

    await store.stop();
  });

  it('set rollback skips if concurrent re-merge changed config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9999 });
    await waitForRemerge(store, (config) => config['port'] === 9999);

    await expect(store.set('port', 8080)).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store.get('port')).toBe(9999);

    await store.stop();
  });

  it('set rollback emits revert events', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

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
    store.on('port', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await expect(store.set('port', 8080)).rejects.toThrow();

    const hasRevert = events.some(
      (event) => event.type === 'modified' && event.next === 3000,
    );
    expect(hasRevert).toBe(true);

    await store.stop();
  });

  it('set triggers re-merge via fs.watch after write', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.set('port', 8080);

    await waitForRemerge(store, (config) => config['port'] === 8080);

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });

  it('set on defaults/overrides layer → throws (no file path, not writable)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
      overrides: { host: 'localhost' },
    });

    await expect(store.set('port', 8080)).rejects.toThrow(
      'morsel: cannot write',
    );

    await store.stop();
  });

  it('get/has reflect mutation after set', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.get('host')).toBeUndefined();
    expect(store.has('host')).toBe(false);

    await store.set('host', 'localhost');

    expect(store.get('host')).toBe('localhost');
    expect(store.has('host')).toBe(true);

    await store.stop();
  });
});
