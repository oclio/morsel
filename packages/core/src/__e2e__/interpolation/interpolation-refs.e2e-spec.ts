import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

import { interpolate } from '@/index';

describe('interpolation-refs — {{ref.path}} cross-references', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('{{ref.path}} cross-references within config', async () => {
    const { result } = await setupTest({
      projectConfig: {
        host: 'localhost',
        url: '{{host}}',
      },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ host: 'localhost', url: 'localhost' });
  });

  it('single {{ref.path}} preserves original type (number)', () => {
    const result = interpolate({ port: 3000, copy: '{{port}}' });

    expect(result).toEqual({ port: 3000, copy: 3000 });
    expect(typeof result['copy']).toBe('number');
  });

  it('single {{ref.path}} preserves original type (object)', () => {
    const result = interpolate({
      nested: { a: 1 },
      ref: '{{nested}}',
    });

    expect(result).toEqual({ nested: { a: 1 }, ref: { a: 1 } });
    expect(typeof result['ref']).toBe('object');
  });

  it('{{ref.path}} not found → left as-is', () => {
    const result = interpolate({ value: '{{missing.path}}' });

    expect(result).toEqual({ value: '{{missing.path}}' });
  });

  it('multiple {{ref.path}} in same string → String coercion', () => {
    const result = interpolate({
      a: 1,
      b: 2,
      label: '{{a}} and {{b}}',
    });

    expect(result).toEqual({ a: 1, b: 2, label: '1 and 2' });
  });

  it('{{ref.path}} to string value → recursive resolution', () => {
    const result = interpolate({
      host: 'localhost',
      url: '{{host}}',
      fullUrl: '{{url}}:8080',
    });

    expect(result).toEqual({
      host: 'localhost',
      url: 'localhost',
      fullUrl: 'localhost:8080',
    });
  });

  it('{{ref.path}} to non-string value → returned as-is', () => {
    const result = interpolate({
      port: 3000,
      nested: { deep: true },
      portRef: '{{port}}',
      nestedRef: '{{nested}}',
    });

    expect(result['portRef']).toBe(3000);
    expect(result['nestedRef']).toEqual({ deep: true });
  });

  it('{{ref.path}} in nested objects', () => {
    const result = interpolate({
      host: 'localhost',
      database: { url: '{{host}}' },
    });

    expect(result).toEqual({
      host: 'localhost',
      database: { url: 'localhost' },
    });
  });

  it('{{ref.path}} in arrays', () => {
    const result = interpolate({
      a: 'first',
      b: 'second',
      items: ['{{a}}', '{{b}}'],
    });

    expect(result).toEqual({
      a: 'first',
      b: 'second',
      items: ['first', 'second'],
    });
  });
});
