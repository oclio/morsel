import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Synchronous atomic file write using a temporary file + rename.
 *
 * Creates parent directories as needed. The temp file is named
 * `<filePath>.tmp.<timestamp>` to avoid collisions.
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
