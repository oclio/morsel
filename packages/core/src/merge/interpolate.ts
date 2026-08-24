import { MorselError } from '@/errors/error';
import { isPlainObject } from '@/merge/merge-helpers';
import { getPathValue } from '@/paths/path-access';

type ConfigRecord = Record<string, unknown>;

const ENV_PATTERN = /\$\{([^{}]+)\}/g;
const REF_PATTERN = /\{\{([^{}]+)\}\}/g;
const SINGLE_REF_PATTERN = /^\{\{([^{}]+)\}\}$/;

/**
 * Interpolate `${VAR}` and `{{ref.path}}` placeholders in a merged config.
 *
 * - `${VAR}` is resolved from `process.env` (or the provided `env` record).
 *   If the variable is not found, the placeholder is left as-is.
 * - `{{ref.path}}` is resolved by looking up `ref.path` in the config itself.
 *   If the entire string is a single `{{ref.path}}`, the referenced value
 *   preserves its original type (number, object, etc.).
 *   If the reference is not found, the placeholder is left as-is.
 * - Circular references (`a → b → a`) throw `MorselError` with code `ECYCLE`.
 *
 * @param config - The merged config to interpolate.
 * @param env - Optional environment record (defaults to `process.env`).
 * @returns A new config with all placeholders resolved.
 */
export function interpolate(
  config: ConfigRecord,
  env: Record<string, string | undefined> = process.env,
): ConfigRecord {
  const root = deepClone(config);
  return resolveObject(root, root, env, new Set());
}

function resolveObject(
  root: ConfigRecord,
  object: ConfigRecord,
  env: Record<string, string | undefined>,
  resolving: Set<string>,
): ConfigRecord {
  for (const key of Object.keys(object)) {
    object[key] = resolveValue(root, object[key], env, resolving);
  }
  return object;
}

function resolveValue(
  root: ConfigRecord,
  value: unknown,
  env: Record<string, string | undefined>,
  resolving: Set<string>,
): unknown {
  if (isPlainObject(value)) {
    return resolveObject(root, value as ConfigRecord, env, resolving);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(root, item, env, resolving));
  }
  if (typeof value === 'string') {
    return resolveString(root, value, env, resolving);
  }
  return value;
}

function resolveString(
  root: ConfigRecord,
  string_: string,
  env: Record<string, string | undefined>,
  resolving: Set<string>,
): unknown {
  let result = string_.replaceAll(
    ENV_PATTERN,
    (match, variableName: string) => {
      const value = env[variableName.trim()];
      return value ?? match;
    },
  );

  const singleReferenceMatch = SINGLE_REF_PATTERN.exec(result);
  if (singleReferenceMatch?.[1]) {
    return resolveReference(
      root,
      singleReferenceMatch[1].trim(),
      env,
      resolving,
    );
  }

  result = result.replaceAll(REF_PATTERN, (match, referencePath: string) => {
    const resolved = resolveReference(
      root,
      referencePath.trim(),
      env,
      resolving,
    );
    return String(resolved);
  });

  return result;
}

function resolveReference(
  root: ConfigRecord,
  referencePath: string,
  env: Record<string, string | undefined>,
  resolving: Set<string>,
): unknown {
  if (resolving.has(referencePath)) {
    const chain = [...resolving, referencePath].join(' → ');
    throw new MorselError(
      undefined,
      'ECYCLE',
      new Error(`circular reference detected: ${chain}`),
    );
  }

  const value = getPathValue(root, referencePath);
  if (value === undefined) {
    return `{{${referencePath}}}`;
  }

  if (typeof value === 'string') {
    resolving.add(referencePath);
    const resolved = resolveString(root, value, env, resolving);
    resolving.delete(referencePath);
    return resolved;
  }

  return value;
}

function deepClone(value: unknown): ConfigRecord {
  if (isPlainObject(value)) {
    const result: ConfigRecord = {};
    for (const [key, value_] of Object.entries(value)) {
      result[key] = deepClone(value_);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as ConfigRecord;
  }
  return value as ConfigRecord;
}
