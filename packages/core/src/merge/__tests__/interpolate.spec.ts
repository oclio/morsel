import { MorselError } from '@/errors/error';
import { interpolate, interpolateInPlace } from '@/merge/interpolate';

describe('interpolate', () => {
  describe('${VAR} env interpolation', () => {
    it.each<{
      name: string;
      input: Record<string, unknown>;
      env: Record<string, string | undefined>;
      expected: unknown;
    }>([
      {
        name: 'resolves ${VAR} from env',
        input: { url: '${DB_URL}' },
        env: { DB_URL: 'postgres://localhost' },
        expected: 'postgres://localhost',
      },
      {
        name: 'resolves multiple ${VAR} in a single string',
        input: { url: '${HOST}:${PORT}' },
        env: { HOST: 'localhost', PORT: '5432' },
        expected: 'localhost:5432',
      },
      {
        name: 'leaves ${VAR} as-is when not found in env',
        input: { url: '${MISSING}' },
        env: {},
        expected: '${MISSING}',
      },
      {
        name: 'resolves ${VAR} inside a larger string',
        input: { url: 'postgres://${HOST}:5432/db' },
        env: { HOST: 'db.example.com' },
        expected: 'postgres://db.example.com:5432/db',
      },
      {
        name: 'trims whitespace around ${VAR} name',
        input: { url: '${ DB_URL }' },
        env: { DB_URL: 'postgres://localhost' },
        expected: 'postgres://localhost',
      },
    ])('$name', ({ input, env, expected }) => {
      const result = interpolate(input, env);

      expect(result['url']).toBe(expected);
    });
  });

  describe('{{ref.path}} cross-reference interpolation', () => {
    it.each<{
      name: string;
      input: Record<string, unknown>;
      expected: unknown;
    }>([
      {
        name: 'resolves {{ref}} to a string value',
        input: { host: 'localhost', url: '{{host}}' },
        expected: 'localhost',
      },
      {
        name: 'resolves {{a.b}} nested path',
        input: { database: { host: 'db.local' }, url: '{{database.host}}' },
        expected: 'db.local',
      },
      {
        name: 'leaves {{ref}} as-is when path not found',
        input: { url: '{{missing.path}}' },
        expected: '{{missing.path}}',
      },
      {
        name: 'resolves {{ref}} inside a larger string as string',
        input: { host: 'localhost', url: 'postgres://{{host}}:5432' },
        expected: 'postgres://localhost:5432',
      },
      {
        name: 'coerces non-string {{ref}} to string inside a larger string',
        input: { port: 5432, url: 'port={{port}}' },
        expected: 'port=5432',
      },
      {
        name: 'trims whitespace around single {{ref}}',
        input: { host: 'localhost', url: '{{ host }}' },
        expected: 'localhost',
      },
      {
        name: 'trims whitespace around {{ref}} in larger string',
        input: { host: 'localhost', url: 'postgres://{{ host }}:5432' },
        expected: 'postgres://localhost:5432',
      },
    ])('$name', ({ input, expected }) => {
      const result = interpolate(input);

      expect(result['url']).toBe(expected);
    });

    it('preserves type when entire string is a single {{ref}}', () => {
      const result = interpolate({
        port: 5432,
        dbPort: '{{port}}',
      });

      expect(result['dbPort']).toBe(5432);
      expect(typeof result['dbPort']).toBe('number');
    });

    it('preserves object type when entire string is a single {{ref}}', () => {
      const result = interpolate({
        defaults: { a: 1, b: 2 },
        inherited: '{{defaults}}',
      });

      expect(result['inherited']).toEqual({ a: 1, b: 2 });
    });

    it('does not preserve type when {{ref}} has trailing content', () => {
      const result = interpolate({
        port: 5432,
        label: '{{port}} extra',
      });

      expect(result['label']).toBe('5432 extra');
      expect(typeof result['label']).toBe('string');
    });

    it('resolves chained references (a → b → c)', () => {
      const result = interpolate({
        a: '{{b}}',
        b: '{{c}}',
        c: 'final',
      });

      expect(result['a']).toBe('final');
    });
  });

  describe('circular reference detection', () => {
    it.each<{ name: string; config: Record<string, unknown> }>([
      { name: 'direct cycle', config: { a: '{{b}}', b: '{{a}}' } },
      {
        name: 'indirect cycle',
        config: { a: '{{b}}', b: '{{c}}', c: '{{a}}' },
      },
    ])('throws MorselError with ECYCLE on $name', ({ config }) => {
      expect(() => interpolate(config)).toThrow(MorselError);
    });

    it('includes cycle chain with → separator in error message', () => {
      let thrown: unknown;

      try {
        interpolate({ a: '{{b}}', b: '{{a}}' });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(MorselError);
      expect((thrown as Error).message).toMatch(/b → a → b/);
    });

    it('sets error code to ECYCLE', () => {
      let thrown: unknown;

      try {
        interpolate({ a: '{{b}}', b: '{{a}}' });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(MorselError);
      expect((thrown as MorselError).code).toBe('ECYCLE');
    });
  });

  describe('nested structures', () => {
    it('interpolates values in nested objects', () => {
      const result = interpolate(
        {
          database: { url: '${DB_URL}' },
        },
        { DB_URL: 'postgres://localhost' },
      );

      const database = result['database'] as Record<string, unknown>;
      expect(database['url']).toBe('postgres://localhost');
    });

    it('interpolates values in arrays', () => {
      const result = interpolate(
        {
          hosts: ['${HOST1}', '${HOST2}'],
        },
        { HOST1: 'a.com', HOST2: 'b.com' },
      );

      expect(result['hosts']).toEqual(['a.com', 'b.com']);
    });

    it('interpolates refs in nested objects', () => {
      const result = interpolate({
        primary: { host: 'localhost' },
        replica: { host: '{{primary.host}}' },
      });

      const replica = result['replica'] as Record<string, unknown>;
      expect(replica['host']).toBe('localhost');
    });
  });

  describe('non-string values', () => {
    it.each<{
      name: string;
      input: Record<string, unknown>;
      key: string;
      expected: unknown;
    }>([
      { name: 'numbers', input: { port: 5432 }, key: 'port', expected: 5432 },
      {
        name: 'booleans',
        input: { enabled: true },
        key: 'enabled',
        expected: true,
      },
      { name: 'null', input: { value: null }, key: 'value', expected: null },
    ])('passes through $name unchanged', ({ input, key, expected }) => {
      const result = interpolate(input);

      expect(result[key]).toBe(expected);
    });
  });

  describe('combined ${VAR} and {{ref}}', () => {
    it('resolves both in the same string', () => {
      const result = interpolate(
        {
          host: 'localhost',
          url: 'postgres://{{host}}:${PORT}',
        },
        { PORT: '5432' },
      );

      expect(result['url']).toBe('postgres://localhost:5432');
    });
  });

  it('does not mutate the input config', () => {
    const input = { url: '${DB_URL}' };

    interpolate(input, { DB_URL: 'resolved' });

    expect(input['url']).toBe('${DB_URL}');
  });

  it('does not mutate nested objects inside arrays in the input', () => {
    const input = { items: [{ name: '${NAME}' }] };

    interpolate(input, { NAME: 'resolved' });

    expect((input['items'] as Record<string, unknown>[])[0]!['name']).toBe(
      '${NAME}',
    );
  });
});

describe('interpolateInPlace', () => {
  it('produces the same result as interpolate', () => {
    const input = {
      host: 'localhost',
      url: 'postgres://{{host}}:${PORT}',
      port: 5432,
      dbPort: '{{port}}',
    };

    const cloned = structuredClone(input);
    const safe = interpolate(cloned, { PORT: '5432' });
    const inPlace = interpolateInPlace(input, { PORT: '5432' });

    expect(inPlace).toEqual(safe);
  });

  it('mutates the input config in place', () => {
    const input = { url: '${DB_URL}' };

    interpolateInPlace(input, { DB_URL: 'resolved' });

    expect(input['url']).toBe('resolved');
  });

  it('returns the same object reference', () => {
    const input = { url: '${DB_URL}' };

    const result = interpolateInPlace(input, { DB_URL: 'resolved' });

    expect(result).toBe(input);
  });

  it('detects circular references', () => {
    expect(() => interpolateInPlace({ a: '{{b}}', b: '{{a}}' })).toThrow(
      MorselError,
    );
  });
});
