import { MorselError } from '@/errors/error';
import { parsePath } from '@/paths/parse-path';
import { getPathValue } from '@/paths/path-access';
import type { StoreState } from '@/store/store-state';

type ConfigRecord = Record<string, unknown>;

/**
 * Resolve a path in the config and assert that the value is an array.
 *
 * @throws MorselError with code `EVALIDATE` if the value is not an array.
 */
function assertArray(
  pathInput: string | readonly (string | number)[],
  config: Record<string, unknown>,
  segments: (string | number)[],
): unknown[] {
  const array = getPathValue(config, segments);
  if (!Array.isArray(array)) {
    throw new MorselError(
      undefined,
      'EVALIDATE',
      new Error(`"${pathInput}" is not an array`),
    );
  }
  return array;
}

/**
 * Build the read-only array lookup methods (`indexOf`, `lastIndexOf`) bound
 * to the given store state. Both resolve `path` against the current config,
 * assert the value is an array (else `MorselError`/`EVALIDATE`), and delegate
 * to the native `Array.prototype` method. Neither mutates the config or the
 * filesystem.
 */
export function createArrayMethods<T extends ConfigRecord>(
  state: StoreState<T>,
) {
  return {
    indexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.indexOf(value);
    },
    lastIndexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.lastIndexOf(value);
    },
  };
}
