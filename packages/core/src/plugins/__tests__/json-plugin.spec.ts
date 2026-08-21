import { jsonPlugin } from '@/plugins/json-plugin';

describe('jsonPlugin', () => {
  describe('metadata', () => {
    it('has name "json"', () => {
      expect(jsonPlugin.name).toBe('json');
    });

    it('supports .json extension only', () => {
      expect(jsonPlugin.extensions).toEqual(['.json']);
    });
  });

  describe('parse', () => {
    it('parses a valid JSON object', () => {
      const result = jsonPlugin.parse('{"a":1,"b":"x"}', '/fake/config.json');

      expect(result).toEqual({ a: 1, b: 'x' });
    });

    it('parses an empty object', () => {
      const result = jsonPlugin.parse('{}', '/fake/config.json');

      expect(result).toEqual({});
    });

    it('parses nested objects', () => {
      const result = jsonPlugin.parse(
        '{"outer":{"inner":{"deep":true}}}',
        '/fake/config.json',
      );

      expect(result).toEqual({ outer: { inner: { deep: true } } });
    });

    it('parses object with array values', () => {
      const result = jsonPlugin.parse('{"list":[1,2,3]}', '/fake/config.json');

      expect(result).toEqual({ list: [1, 2, 3] });
    });

    it.each([
      { name: 'invalid JSON', input: '{invalid}' },
      { name: 'empty string', input: '' },
    ])('throws SyntaxError on $name', ({ input }) => {
      expect(() => jsonPlugin.parse(input, '/fake/config.json')).toThrow(
        SyntaxError,
      );
    });

    it.each([
      { name: 'null', input: 'null' },
      { name: 'an array', input: '[1,2,3]' },
      { name: 'a number', input: '42' },
      { name: 'a string', input: '"hello"' },
      { name: 'a boolean', input: 'true' },
    ])('throws SyntaxError when root is $name', ({ input }) => {
      expect(() => jsonPlugin.parse(input, '/fake/config.json')).toThrow(
        SyntaxError,
      );
    });

    it('throws SyntaxError with descriptive message for non-object root', () => {
      try {
        jsonPlugin.parse('[1,2,3]', '/fake/config.json');
        throw new Error('expected function to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
        expect((error as SyntaxError).message).toBe(
          'JSON root must be an object',
        );
      }
    });

    it('does not use filePath in parsing logic', () => {
      const result = jsonPlugin.parse('{"a":1}', '/completely/different.json');

      expect(result).toEqual({ a: 1 });
    });
  });
});
