import { homedir } from 'node:os';
import path from 'node:path';

import { resolveGlobalDirectory } from '@/paths/resolve-paths';

describe('resolve-paths-global-dir — globalDir resolution', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.unstubAllEnvs();
  });

  it('tilde expansion: ~/path → <homedir>/path', () => {
    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '~/.morsel-test',
    });

    expect(result).toBe(path.resolve(homedir(), '.morsel-test'));
  });

  it('tilde only: ~ → <homedir>', () => {
    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '~',
    });

    expect(result).toBe(homedir());
  });

  it('empty string globalDir → falls through to default', () => {
    const result = resolveGlobalDirectory({ name: 'myapp', globalDir: '' });

    expect(result).toBe(path.resolve(homedir(), '.config', 'myapp'));
  });

  it('Windows fallback: APPDATA/<name> on win32', () => {
    vi.stubEnv('APPDATA', 'C:\\AppData');
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    const result = resolveGlobalDirectory({ name: 'myapp' });

    expect(result).toBe(path.resolve('C:\\AppData', 'myapp'));
  });

  it('default: ~/.config/<name>', () => {
    const result = resolveGlobalDirectory({ name: 'myapp' });

    expect(result).toBe(path.resolve(homedir(), '.config', 'myapp'));
  });
});
