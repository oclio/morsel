import { promises as fs } from 'node:fs';

import { createMockLayer } from '@oclio/test-helpers';

import {
  backupDirtyFiles,
  cleanupBackups,
  restoreFromBak,
} from '@/store/transaction-backup';
import type { MorselLayer } from '@/store/types';

vi.mock('node:fs', () => ({
  promises: {
    copyFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));

function makeLayer(filePath: string): MorselLayer {
  return createMockLayer({ path: filePath, config: {} }) as MorselLayer;
}

describe('backupDirtyFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
  });

  it('copies each dirty layer file to a .bak backup', async () => {
    const layers = [makeLayer('/project/config.json')];

    const backups = await backupDirtyFiles(layers);

    expect(backups).toEqual([
      {
        bakPath: '/project/config.json.bak',
        originalPath: '/project/config.json',
      },
    ]);
    expect(fs.copyFile).toHaveBeenCalledWith(
      '/project/config.json',
      '/project/config.json.bak',
    );
  });

  it('skips backup when file does not exist (ENOENT)', async () => {
    const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    vi.mocked(fs.copyFile).mockRejectedValueOnce(enoentError);

    const backups = await backupDirtyFiles([makeLayer('/missing.json')]);

    expect(backups).toEqual([]);
  });

  it('rethrows non-ENOENT backup errors', async () => {
    vi.mocked(fs.copyFile).mockRejectedValueOnce(
      new Error('permission denied'),
    );

    await expect(backupDirtyFiles([makeLayer('/locked.json')])).rejects.toThrow(
      'permission denied',
    );
  });
});

describe('cleanupBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
  });

  it('deletes all .bak files', async () => {
    const backups = [
      { bakPath: '/a.json.bak', originalPath: '/a.json' },
      { bakPath: '/b.json.bak', originalPath: '/b.json' },
    ];

    await cleanupBackups(backups);

    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith('/a.json.bak');
    expect(fs.unlink).toHaveBeenCalledWith('/b.json.bak');
  });

  it('ignores cleanup errors — .bak is already orphaned', async () => {
    vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EBUSY'));

    await cleanupBackups([{ bakPath: '/a.json.bak', originalPath: '/a.json' }]);
  });

  it('handles empty backups array', async () => {
    await cleanupBackups([]);

    expect(fs.unlink).not.toHaveBeenCalled();
  });
});

describe('restoreFromBak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.rename).mockResolvedValue(undefined);
  });

  it('renames each .bak back to its original path', async () => {
    const backups = [
      { bakPath: '/a.json.bak', originalPath: '/a.json' },
      { bakPath: '/b.json.bak', originalPath: '/b.json' },
    ];

    await restoreFromBak(backups);

    expect(fs.rename).toHaveBeenCalledTimes(2);
    expect(fs.rename).toHaveBeenCalledWith('/a.json.bak', '/a.json');
    expect(fs.rename).toHaveBeenCalledWith('/b.json.bak', '/b.json');
  });

  it('ignores restore errors — best-effort, .bak may be manually recovered', async () => {
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('ENOENT'));

    await restoreFromBak([
      { bakPath: '/missing.json.bak', originalPath: '/missing.json' },
    ]);
  });

  it('handles empty backups array', async () => {
    await restoreFromBak([]);

    expect(fs.rename).not.toHaveBeenCalled();
  });
});
