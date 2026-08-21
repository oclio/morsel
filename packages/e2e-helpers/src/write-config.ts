import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ConfigRecord = Record<string, unknown>;

/**
 * Write a JSON config file atomically (.tmp + rename) to avoid
 * `fs.watch` firing on a half-written file.
 */
export async function writeConfig(
  directory: string,
  filename: string,
  config: ConfigRecord,
): Promise<string> {
  const targetPath = path.resolve(directory, filename);
  const temporaryPath = `${targetPath}.tmp`;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(
    temporaryPath,
    `${JSON.stringify(config, undefined, 2)}\n`,
    'utf8',
  );
  await rename(temporaryPath, targetPath);

  return targetPath;
}
