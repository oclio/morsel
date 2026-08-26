import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('read-ops-security — prototype protection', () => {
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

  it.each(['__proto__', 'constructor', 'prototype'])(
    'get with %s string path throws TypeError',
    async (unsafeKey) => {
      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        defaults: { port: 3000 },
      });

      expect(() => store.get(unsafeKey)).toThrow(TypeError);

      await store.stop();
    },
  );

  it.each(['__proto__', 'constructor'])(
    'has with %s string path throws TypeError',
    async (unsafeKey) => {
      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        defaults: { port: 3000 },
      });

      expect(() => store.has(unsafeKey)).toThrow(TypeError);

      await store.stop();
    },
  );

  it('get with array path containing __proto__ throws TypeError (spec: any access rejected)', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 3000 },
    });

    expect(() => store.get(['__proto__'])).toThrow(TypeError);

    await store.stop();
  });
});
