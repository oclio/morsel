import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('headless-mode — watch/proxy/queue flags', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  describe('watch: false', () => {
    it('boots and reads config without watchers', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
      });

      expect(store.get('port')).toBe(3000);
      await store.stop();
    });

    it('set() persists to disk without re-merge', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
      });

      await store.set('port', 8080);

      expect(store.get('port')).toBe(8080);

      const content = JSON.parse(
        await readFile(
          path.resolve(projectDirectory, 'myapp.config.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      expect(content['port']).toBe(8080);

      await store.stop();
    });

    it('does not react to external file changes', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
      });

      // Modify file on disk after boot
      await writeFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        JSON.stringify({ port: 9999 }),
      );

      // Wait a bit to ensure no re-merge fires
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Store still has the original value — no re-merge
      expect(store.get('port')).toBe(3000);

      await store.stop();
    });

    it('on() listener fires on store.set() without watchers', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
      });

      const events: { type: string; next: unknown; prev: unknown }[] = [];
      store.on('port', (event) => {
        events.push({ type: event.type, next: event.next, prev: event.prev });
      });

      await store.set('port', 8080);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'modified',
        next: 8080,
        prev: 3000,
      });

      await store.stop();
    });

    it('signal still calls stop() without watchers', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const controller = new AbortController();
      controller.abort();

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        signal: controller.signal,
      });

      // store.stop() was called immediately because signal was already aborted
      expect(store.get('port')).toBe(3000);

      // stop() is idempotent — calling again is safe
      await store.stop();
    });
  });

  describe('proxy: false', () => {
    it('store.config returns raw config object', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000, host: 'localhost' },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
      });

      const config = store.config;
      expect(config).toEqual({ port: 3000, host: 'localhost' });

      await store.stop();
    });

    it('store.get() works without proxy', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { server: { port: 3000, host: 'localhost' } },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
      });

      expect(store.get('server.port')).toBe(3000);
      expect(store.get('server.host')).toBe('localhost');
      expect(store.has('server')).toBe(true);

      await store.stop();
    });

    it('frozen config is frozen without proxy', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
        configMutability: 'frozen',
      });

      expect(Object.isFrozen(store.config)).toBe(true);

      await store.stop();
    });

    it('mutable config: direct mutation does not persist to disk', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
        configMutability: 'mutable',
      });

      // Direct mutation modifies in-memory state
      (store.config as Record<string, unknown>)['port'] = 9999;
      expect(store.get('port')).toBe(9999);

      // But disk is not written — file still has original value
      const content = JSON.parse(
        await readFile(
          path.resolve(projectDirectory, 'myapp.config.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      expect(content['port']).toBe(3000);

      await store.stop();
    });
  });

  describe('queue: false', () => {
    it('set() works without queue', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        queue: false,
      });

      await store.set('port', 8080);

      expect(store.get('port')).toBe(8080);

      const content = JSON.parse(
        await readFile(
          path.resolve(projectDirectory, 'myapp.config.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      expect(content['port']).toBe(8080);

      await store.stop();
    });

    it('unset() works without queue', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000, host: 'localhost' },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        queue: false,
      });

      const result = await store.unset('port');

      expect(result).toBe(true);
      expect(store.has('port')).toBe(false);

      await store.stop();
    });

    it('stop() does not wait for in-flight mutation when queue is false', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        queue: false,
      });

      // Start a set and immediately stop — stop() should not wait
      const setPromise = store.set('port', 8080);
      await store.stop();

      // set() may still be in flight — await it to avoid unhandled rejection
      await setPromise;

      // Config is readable after stop
      expect(store.get('port')).toBe(8080);
    });
  });

  describe('full headless — watch: false, proxy: false, queue: false', () => {
    it('boot + set + read + stop works end-to-end', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
        queue: false,
      });

      expect(store.get('port')).toBe(3000);

      await store.set('port', 8080);
      await store.set('host', '0.0.0.0');

      expect(store.get('port')).toBe(8080);
      expect(store.get('host')).toBe('0.0.0.0');

      const content = JSON.parse(
        await readFile(
          path.resolve(projectDirectory, 'myapp.config.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      expect(content).toEqual({ port: 8080, host: '0.0.0.0' });

      await store.stop();

      // Config still readable after stop
      expect(store.get('port')).toBe(8080);
    });

    it('on() fires without proxy, watch, or queue', async () => {
      const { projectDirectory, globalDirectory } = await setupTest({
        projectConfig: { port: 3000 },
        createGlobalDir: true,
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        watch: false,
        proxy: false,
        queue: false,
      });

      const events: { type: string; next: unknown; prev: unknown }[] = [];
      store.on('port', (event) => {
        events.push({ type: event.type, next: event.next, prev: event.prev });
      });

      await store.set('port', 8080);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'modified',
        next: 8080,
        prev: 3000,
      });

      await store.stop();
    });
  });
});
