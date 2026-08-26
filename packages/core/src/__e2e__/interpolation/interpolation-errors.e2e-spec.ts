import { interpolate } from '@/index';

describe('interpolation-errors — circular references', () => {
  it('circular reference → MorselError(ECYCLE)', () => {
    expect(() => interpolate({ a: '{{b}}', b: '{{a}}' })).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'ECYCLE' }),
    );
  });

  it('circular reference chain message: "b → a → b"', () => {
    expect(() => interpolate({ a: '{{b}}', b: '{{a}}' })).toThrow(/b → a → b/);
  });

  it('self-reference: {{a}} in value of a → ECYCLE', () => {
    expect(() => interpolate({ a: '{{a}}' })).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'ECYCLE' }),
    );
  });
});
