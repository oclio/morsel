import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('read-ops-dotify — dotify() API', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('dotify(): flatten to 1D dotted record', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        port: 3000,
        host: 'localhost',
      },
    });

    expect(store.dotify()).toEqual({
      port: 3000,
      host: 'localhost',
    });

    await store.stop();
  });

  it('dotify on nested objects', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        server: {
          host: 'localhost',
          port: 3000,
          credentials: { user: 'admin', password: 'secret' },
        },
      },
    });

    expect(store.dotify()).toEqual({
      'server.host': 'localhost',
      'server.port': 3000,
      'server.credentials.user': 'admin',
      'server.credentials.password': 'secret',
    });

    await store.stop();
  });

  it('dotify on arrays', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        tags: ['a', 'b', 'c'],
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      },
    });

    expect(store.dotify()).toEqual({
      'tags[0]': 'a',
      'tags[1]': 'b',
      'tags[2]': 'c',
      'users[0].name': 'Alice',
      'users[1].name': 'Bob',
    });

    await store.stop();
  });

  it('dotify on keys with literal dots (escaped)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        'app.config': { host: 'example.com', port: 8443 },
      },
    });

    expect(store.dotify()).toEqual({
      'app.config.host': 'example.com',
      'app.config.port': 8443,
    });

    await store.stop();
  });

  it('dotify on primitives', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: {
        port: 3000,
        enabled: true,
        ratio: 0.95,
        empty: '',
      },
    });

    expect(store.dotify()).toEqual({
      port: 3000,
      enabled: true,
      ratio: 0.95,
      empty: '',
    });

    await store.stop();
  });

  it('dotify on empty config: returns {}', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store.dotify()).toEqual({});

    await store.stop();
  });

  it('dotify after stop: still works', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      server: { host: 'localhost' },
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store.stop();

    expect(store.dotify()).toEqual({
      port: 3000,
      'server.host': 'localhost',
    });
  });
});
