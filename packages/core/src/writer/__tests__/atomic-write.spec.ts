import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { atomicWrite, atomicWriteSync } from '@/writer/atomic-write';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
  };
});

describe('atomicWrite', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'atomic-write-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('writes content to the target file', async () => {
    const filePath = path.join(temporaryDirectory, 'config.json');

    await atomicWrite(filePath, '{"port":3000}');

    expect(readFileSync(filePath, 'utf8')).toBe('{"port":3000}');
  });

  it('creates parent directories if they do not exist', async () => {
    const filePath = path.join(
      temporaryDirectory,
      'nested',
      'deep',
      'config.json',
    );

    await atomicWrite(filePath, '{"port":3000}');

    expect(existsSync(filePath)).toBe(true);
  });

  it('overwrites existing file', async () => {
    const filePath = path.join(temporaryDirectory, 'config.json');
    await atomicWrite(filePath, '{"old":true}');

    await atomicWrite(filePath, '{"new":true}');

    expect(readFileSync(filePath, 'utf8')).toBe('{"new":true}');
  });

  it('does not leave temp files on success', async () => {
    const filePath = path.join(temporaryDirectory, 'config.json');

    await atomicWrite(filePath, '{"port":3000}');

    const temporaryFiles = readdirSync(temporaryDirectory).filter((f) =>
      f.includes('.tmp.'),
    );
    expect(temporaryFiles).toHaveLength(0);
  });

  it('passes utf8 encoding to writeFile', async () => {
    const { writeFile } = await import('node:fs/promises');
    vi.mocked(writeFile).mockClear();
    const filePath = path.join(temporaryDirectory, 'config.json');

    await atomicWrite(filePath, '{"port":3000}');

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp.'),
      '{"port":3000}',
      'utf8',
    );
  });
});

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
