import path from 'node:path';

type ConfigRecord = Record<string, unknown>;

/**
 * Return a shallow copy of `config` with the `extends` key removed.
 */
export function stripExtends(config: ConfigRecord): ConfigRecord {
  const result: ConfigRecord = { ...config };
  delete result['extends'];
  return result;
}

/**
 * Normalize an `extends` value (string or string[]) into an array of
 * absolute paths resolved against `baseDirectory`.
 * Non-string entries are filtered out; non-array/non-string values return `[]`.
 */
export function normalizeExtends(
  value: unknown,
  baseDirectory: string,
): string[] {
  if (typeof value === 'string') {
    return [path.resolve(baseDirectory, value)];
  }

  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => path.resolve(baseDirectory, v));
  }

  return [];
}
