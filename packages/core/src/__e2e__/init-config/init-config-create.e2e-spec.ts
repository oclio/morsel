import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-create — basic file creation', () => {
  let directory: string;
  let projectDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    await mkdir(projectDirectory, { recursive: true });
  });

  it('writes ./<name>.config.json and returns the path', () => {
    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));
    expect(existsSync(result)).toBe(true);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });

  it('writes {} when neither content nor fallbackContent provided', () => {
    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({});
  });

  it('writes fallbackContent when content is not provided', () => {
    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      fallbackContent: { port: 3000, host: 'localhost' },
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000, host: 'localhost' });
  });

  it('content takes priority over fallbackContent when both provided', () => {
    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
      fallbackContent: { port: 9999, fallback: true },
    });

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });

  it('mkdir: cwd does not exist → mkdirSync creates parents', () => {
    const nestedDirectory = `${directory}/project/nested/deep`;

    expect(existsSync(nestedDirectory)).toBe(false);

    const result = initConfig({
      name: 'myapp',
      cwd: nestedDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(nestedDirectory, 'myapp.config.json'));
    expect(existsSync(result)).toBe(true);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });
});
