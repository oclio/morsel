import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ConfigRecord = Record<string, unknown>;

/**
 * Write a JSON config file atomically (.tmp + rename) to avoid
 * `fs.watch` firing on a half-written file.
 *
 * @param directory - Target directory (created if it does not exist).
 * @param filename - File name within the directory (e.g. `'myapp.config.json'`).
 * @param config - The config object to serialize as JSON.
 * @returns The absolute path of the written file.
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
