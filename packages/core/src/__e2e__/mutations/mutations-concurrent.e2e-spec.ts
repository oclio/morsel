import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-test-helpers';

describe('mutations-concurrent — serialization', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('concurrent mutations to same file: serialized per file path', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await Promise.all([
      store!.set('a', 1),
      store!.set('b', 2),
      store!.set('c', 3),
    ]);

    expect(store!.config).toEqual({ port: 3000, a: 1, b: 2, c: 3 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 3000, a: 1, b: 2, c: 3 });

    await store!.stop();
  });

  it('10 concurrent sets on same file: all values persisted', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {},
      watch: true,
    });

    const keys = Array.from({ length: 10 }, (_, index) => `key${index}`);
    await Promise.all(keys.map((key, index) => store!.set(key, index)));

    for (let index = 0; index < 10; index++) {
      expect(store!.get(`key${index}`)).toBe(index);
    }

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    for (let index = 0; index < 10; index++) {
      expect(content[`key${index}`]).toBe(index);
    }

    await store!.stop();
  });

  it('10 concurrent sets on different keys: all values persisted', async () => {
    const { store } = await setupTest({
      projectConfig: { base: true },
      watch: true,
    });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store!.set(`server.port${index}`, 1000 + index),
      ),
    );

    for (let index = 0; index < 10; index++) {
      expect(store!.get(`server.port${index}`)).toBe(1000 + index);
    }

    await store!.stop();
  });

  it('concurrent set and unset on same key: no race condition', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { target: 'initial' },
      watch: true,
    });

    await Promise.all([
      store!.set('target', 'updated'),
      store!.unset('target'),
    ]);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;

    expect(typeof content).toBe('object');

    await store!.stop();
  });

  it('stop() during in-flight mutation: mutation completes before stop', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {},
      watch: true,
    });

    const writePromise = store!.set('port', 8080);
    const stopPromise = store!.stop();

    await Promise.all([writePromise, stopPromise]);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['port']).toBe(8080);
  });

  it('100 concurrent sets on same key: last value wins (order guaranteed)', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: {},
      watch: true,
    });

    await Promise.all(
      Array.from({ length: 100 }, (_, index) => store!.set('counter', index)),
    );

    expect(store!.get('counter')).toBe(99);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['counter']).toBe(99);

    await store!.stop();
  });

  it('concurrent set and unset on same key: deterministic final state', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { target: 'initial' },
      watch: true,
    });

    // set then unset in sequence — unset should win (last in queue)
    const setPromise = store!.set('target', 'updated');
    const unsetPromise = store!.unset('target');

    await Promise.all([setPromise, unsetPromise]);

    // The queue processes set first, then unset — key should be gone
    expect(store!.has('target')).toBe(false);

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content['target']).toBeUndefined();

    await store!.stop();
  });

  it('concurrent sets on global and project: both layers persisted', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { projectKey: 'project' },
      globalConfig: { globalKey: 'global' },
      watch: true,
    });

    await Promise.all([
      store!.set('projectNew', 'p', 'project'),
      store!.set('globalNew', 'g', 'global'),
    ]);

    expect(store!.get('projectNew')).toBe('p');
    expect(store!.get('globalNew')).toBe('g');

    const projectContent = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(projectContent['projectNew']).toBe('p');

    const globalContent = JSON.parse(
      await readFile(
        path.resolve(globalDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(globalContent['globalNew']).toBe('g');

    await store!.stop();
  });

  it('mutation during re-merge: mutation completes and re-merge applies', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    // Trigger a re-merge by modifying the file externally
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      external: 'added',
    });

    // Concurrently, set a key via the store API
    await store!.set('viaApi', 'set');

    // Wait for re-merge to settle
    await waitForRemerge(
      store as never,
      (config) => config['external'] === 'added',
    );

    // Both the external change and the API mutation should be present
    expect(store!.get('external')).toBe('added');
    expect(store!.get('viaApi')).toBe('set');

    await store!.stop();
  });

  it('50 concurrent sets + 50 concurrent unsets: queue processes all', async () => {
    const initialConfig: Record<string, unknown> = {};
    for (let index = 0; index < 50; index++) {
      initialConfig[`key${index}`] = `value${index}`;
    }

    const { store } = await setupTest({
      projectConfig: initialConfig,
      watch: true,
    });

    const sets = Array.from({ length: 50 }, (_, index) =>
      store!.set(`newKey${index}`, index),
    );
    const unsets = Array.from({ length: 50 }, (_, index) =>
      store!.unset(`key${index}`),
    );

    await Promise.all([...sets, ...unsets]);

    // All new keys should be present
    for (let index = 0; index < 50; index++) {
      expect(store!.get(`newKey${index}`)).toBe(index);
    }

    // All original keys should be gone
    for (let index = 0; index < 50; index++) {
      expect(store!.has(`key${index}`)).toBe(false);
    }

    await store!.stop();
  });
});
