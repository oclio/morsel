import { jsonPlugin } from '@/plugins/json-plugin';
import { selectParser } from '@/plugins/select-parser';
import type { MorselFormatPlugin } from '@/plugins/types';

describe('selectParser', () => {
  const yamlPlugin: MorselFormatPlugin = {
    name: 'yaml',
    extensions: ['.yaml', '.yml'],
    parse: () => ({}),
    serialize: () => '',
  };

  it('returns the plugin matching the file extension', () => {
    const result = selectParser('/fake/config.json', [jsonPlugin, yamlPlugin]);

    expect(result).toBe(jsonPlugin);
  });

  it('returns the first matching plugin when multiple match', () => {
    const duplicateJson: MorselFormatPlugin = {
      name: 'json2',
      extensions: ['.json'],
      parse: () => ({}),
      serialize: () => '',
    };

    const result = selectParser('/fake/config.json', [
      jsonPlugin,
      duplicateJson,
    ]);

    expect(result).toBe(jsonPlugin);
  });

  it('returns undefined when no plugin matches', () => {
    const result = selectParser('/fake/config.toml', [jsonPlugin, yamlPlugin]);

    expect(result).toBeUndefined();
  });

  it('returns undefined for empty plugins list', () => {
    const result = selectParser('/fake/config.json', []);

    expect(result).toBeUndefined();
  });

  it.each([
    { name: '.yaml', filePath: '/fake/config.yaml' },
    { name: '.yml', filePath: '/fake/config.yml' },
  ])('matches $name extension', ({ filePath }) => {
    const result = selectParser(filePath, [jsonPlugin, yamlPlugin]);

    expect(result).toBe(yamlPlugin);
  });

  it('returns undefined for file with no extension', () => {
    const result = selectParser('/fake/config', [jsonPlugin]);

    expect(result).toBeUndefined();
  });

  it('is case-sensitive on extension', () => {
    const result = selectParser('/fake/config.JSON', [jsonPlugin]);

    expect(result).toBeUndefined();
  });
});
