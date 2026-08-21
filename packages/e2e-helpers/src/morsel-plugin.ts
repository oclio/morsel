export interface CustomFormatPlugin {
  readonly name: string;
  readonly extensions: readonly string[];
  parse(content: string, filePath?: string): Record<string, unknown>;
}

/**
 * Simple `key=value` format plugin used by e2e tests that need a
 * non-JSON format. Parses one `key=value` pair per line into a
 * numeric record.
 */
export const morselPlugin: CustomFormatPlugin = {
  name: 'morsel',
  extensions: ['.morsel'],
  parse: (content: string) => {
    const result: Record<string, unknown> = {};
    for (const line of content.split('\n')) {
      const [key, value] = line.split('=', 2);
      if (key && value !== undefined) {
        result[key.trim() as string] = Number(value.trim());
      }
    }
    return result;
  },
};
