import path from 'node:path';

import type { FormatPlugin } from '@/plugins/types';

/**
 * Select the first format plugin whose extensions include the file's extension.
 *
 * Match is case-sensitive on `path.extname(filePath)`.
 * Returns `undefined` if no plugin matches.
 *
 * @param filePath - Absolute path to the config file.
 * @param formatPlugins - Ordered list of format plugins (priority = order).
 */
export function selectParser(
  filePath: string,
  formatPlugins: readonly FormatPlugin[],
): FormatPlugin | undefined {
  const extension = path.extname(filePath);
  return formatPlugins.find((plugin) => plugin.extensions.includes(extension));
}
