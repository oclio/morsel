type ConfigRecord = Record<string, unknown>;

interface MorselFormatPlugin {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string, filePath: string): Record<string, unknown>;
  serialize(data: Record<string, unknown>): string;
}

/**
 * Create a mock format plugin for a custom extension (e.g. `.morsel`).
 * Used by multi-format e2e tests.
 */
export function mockPlugin(
  name: string,
  extensions: readonly string[],
  parse: (content: string, filePath: string) => ConfigRecord = () => ({}),
  serialize: (data: Record<string, unknown>) => string = (data) =>
    JSON.stringify(data, undefined, 2) + '\n',
): MorselFormatPlugin {
  return {
    name,
    extensions,
    parse,
    serialize,
  };
}
