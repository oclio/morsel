import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { atomicWriteSync } from '@/writer/atomic-write';

describe('atomicWriteSync', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'atomic-write-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('writes content to the target file synchronously', () => {
    const filePath = path.join(temporaryDirectory, 'config.json');

    atomicWriteSync(filePath, '{"port":3000}');

    expect(readFileSync(filePath, 'utf8')).toBe('{"port":3000}');
  });

  it('creates parent directories if they do not exist', () => {
    const filePath = path.join(
      temporaryDirectory,
      'nested',
      'deep',
      'config.json',
    );

    atomicWriteSync(filePath, '{"port":3000}');

    expect(existsSync(filePath)).toBe(true);
  });

  it('overwrites existing file', () => {
    const filePath = path.join(temporaryDirectory, 'config.json');
    atomicWriteSync(filePath, '{"old":true}');

    atomicWriteSync(filePath, '{"new":true}');

    expect(readFileSync(filePath, 'utf8')).toBe('{"new":true}');
  });

  it('does not leave temp files on success', () => {
    const filePath = path.join(temporaryDirectory, 'config.json');

    atomicWriteSync(filePath, '{"port":3000}');

    const temporaryFiles = readdirSync(temporaryDirectory).filter((f) =>
      f.includes('.tmp.'),
    );
    expect(temporaryFiles).toHaveLength(0);
  });
});
