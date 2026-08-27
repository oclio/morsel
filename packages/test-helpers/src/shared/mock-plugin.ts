type ConfigRecord = Record<string, unknown>;

interface FormatPlugin {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string, filePath: string): Record<string, unknown>;
  serialize(data: Record<string, unknown>): string;
}

/**
 * Create a mock format plugin for a custom extension (e.g. `.morsel`).
 * Used by multi-format e2e tests.
 *
 * @param name - Plugin name (e.g. `'mock'`).
 * @param extensions - File extensions the plugin handles (e.g. `['.morsel']`).
 * @param parse - Optional parse function; defaults to returning an empty object.
 * @param serialize - Optional serialize function; defaults to `JSON.stringify`.
 * @returns A `FormatPlugin` object ready to pass to `formatPlugins`.
 */
export function mockPlugin(
  name: string,
  extensions: readonly string[],
  parse: (content: string, filePath: string) => ConfigRecord = () => ({}),
  serialize: (data: Record<string, unknown>) => string = (data) =>
    JSON.stringify(data, undefined, 2) + '\n',
): FormatPlugin {
  return {
    name,
    extensions,
    parse,
    serialize,
  };
}
