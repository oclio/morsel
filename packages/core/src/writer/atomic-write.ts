import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a file atomically using a temporary file + rename.
 *
 * Creates parent directories as needed. The temp file is named
 * `<filePath>.tmp.<timestamp>` to avoid collisions.
 *
 * @param filePath - Absolute destination path.
 * @param content - Serialized content to write.
 */
export async function atomicWrite(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp.${Date.now()}`;
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, filePath);
}

/**
 * Synchronous version of {@link atomicWrite}.
 *
 * @param filePath - Absolute destination path.
 * @param content - Serialized content to write.
 */
export function atomicWriteSync(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp.${Date.now()}`;
  writeFileSync(temporaryPath, content, 'utf8');
  renameSync(temporaryPath, filePath);
}
