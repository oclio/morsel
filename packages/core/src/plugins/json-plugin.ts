import type { MorselFormatPlugin } from '@/plugins/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Built-in JSON format plugin.
 *
 * Parses JSON content and validates that the root is a plain object
 * (not null, array, or primitive). Throws `SyntaxError` on invalid JSON,
 * which core wraps into `MorselError` (code `EPARSE`).
 */
export const jsonPlugin: MorselFormatPlugin = {
  name: 'json',
  extensions: ['.json'],
  parse(content: string, _filePath: string): ConfigRecord {
    const parsed: unknown = JSON.parse(content);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new SyntaxError('JSON root must be an object');
    }
    return parsed as ConfigRecord;
  },
};
