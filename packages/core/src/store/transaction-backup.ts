import { promises as fs } from 'node:fs';

import type { MorselLayer } from '@/store/types';

/**
 * Backup entry tracking the `.bak` path and its original file path.
 * Used by {@link cleanupBackups} on success and {@link restoreFromBak} on failure.
 */
export interface BackupEntry {
  bakPath: string;
  originalPath: string;
}

/**
 * Copy each dirty layer's file to a `.bak` backup before writing.
 * Files that don't exist yet (ENOENT) are skipped — the write will create them.
 * Other errors propagate.
 */
export async function backupDirtyFiles(
  dirtyLayers: MorselLayer[],
): Promise<BackupEntry[]> {
  const backups: BackupEntry[] = [];
  for (const layer of dirtyLayers) {
    const filePath = layer.path as string;
    const bakPath = `${filePath}.bak`;
    try {
      await fs.copyFile(filePath, bakPath);
      backups.push({ bakPath, originalPath: filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet — no backup needed, write will create it
      } else {
        throw error;
      }
    }
  }
  return backups;
}

/**
 * Delete all `.bak` files after a successful commit.
 * Cleanup errors are ignored — the `.bak` files are already orphaned.
 */
export async function cleanupBackups(backups: BackupEntry[]): Promise<void> {
  for (const { bakPath } of backups) {
    try {
      await fs.unlink(bakPath);
    } catch {
      // Ignore cleanup errors — .bak is already orphaned
    }
  }
}

/**
 * Restore original files from `.bak` backups after a commit failure.
 * Best-effort — rename errors are ignored so a single failure doesn't
 * block restoration of other files. The `.bak` files may be manually recovered.
 */
export async function restoreFromBak(backups: BackupEntry[]): Promise<void> {
  for (const { bakPath, originalPath } of backups) {
    try {
      await fs.rename(bakPath, originalPath);
    } catch {
      // Best-effort restore — .bak may be manually recovered
    }
  }
}
