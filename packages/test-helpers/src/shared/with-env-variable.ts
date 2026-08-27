/**
 * Temporarily set an environment variable for the duration of a callback,
 * then restore the original value (or delete it if it was unset).
 *
 * Usage:
 *   `await withEnvironmentVariable('NODE_ENV', 'ci', async () => { ... });`
 *   `await withEnvironmentVariable('NODE_ENV', undefined, async () => { ... });` // deletes
 */
export async function withEnvironmentVariable<T>(
  key: string,
  value: string | undefined,
  callback: () => Promise<T> | T,
): Promise<T> {
  const original = process.env[key];

  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    process.env[key] = value;
  }

  try {
    return await callback();
  } finally {
    if (original === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = original;
    }
  }
}
