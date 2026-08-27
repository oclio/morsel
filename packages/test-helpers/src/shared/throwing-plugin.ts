import type { CustomFormatPlugin } from './morsel-plugin';

/**
Options for {@link createThrowingPlugin}.
*/
export interface ThrowingPluginOptions {
  /**
   * Which method should throw. Defaults to 'serialize'.
   */
  readonly throwOn?: 'parse' | 'serialize';
  /**
   * Throw only after N successful calls. 0 = always throw. Defaults to 0.
   */
  readonly failAfter?: number;
  /**
   * Plugin name. Defaults to 'throwing'.
   */
  readonly name?: string;
  /**
   * Error message thrown. Defaults to 'serialize failed' or 'parse failed'.
   */
  readonly errorMessage?: string;
}

/**
 * Create a format plugin that throws on `parse` or `serialize` for testing
 * write-failure rollback and parse-error handling.
 *
 * Usage:
 *   `const plugin = createThrowingPlugin();`                    // always throws on serialize
 *   `const plugin = createThrowingPlugin({ throwOn: 'parse' });` // throws on parse
 *   `const plugin = createThrowingPlugin({ failAfter: 1 });`     // succeeds once, then throws
 */
export function createThrowingPlugin(
  options?: ThrowingPluginOptions,
): CustomFormatPlugin {
  const {
    throwOn = 'serialize',
    failAfter = 0,
    name = 'throwing',
    errorMessage,
  } = options ?? {};

  let callCount = 0;

  const shouldThrow = () => {
    callCount++;
    return callCount > failAfter;
  };

  const parse = (content: string): Record<string, unknown> => {
    if (throwOn === 'parse' && shouldThrow()) {
      throw new Error(errorMessage ?? 'parse failed');
    }
    return JSON.parse(content) as Record<string, unknown>;
  };

  const serialize = (data: Record<string, unknown>): string => {
    if (throwOn === 'serialize' && shouldThrow()) {
      throw new Error(errorMessage ?? 'serialize failed');
    }
    return `${JSON.stringify(data, undefined, 2)}\n`;
  };

  return { name, extensions: ['.json'], parse, serialize };
}
