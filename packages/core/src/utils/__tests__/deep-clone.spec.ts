import { isPlainObject } from '@/merge/merge-helpers';
import { deepClone } from '@/utils/deep-clone';

vi.mock('@/merge/merge-helpers', () => ({
  isPlainObject: vi.fn(),
}));

describe('deepClone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPlainObject).mockImplementation(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype,
    );
  });

  it('clones plain objects recursively', () => {
    const input = { a: { b: { c: 1 } } };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone['a']).not.toBe(input['a']);
    expect((clone['a'] as Record<string, unknown>)['b']).not.toBe(
      (input['a'] as Record<string, unknown>)['b'],
    );
  });

  it('clones arrays element by element', () => {
    const input = { items: [{ x: 1 }, { y: 2 }] };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    const cloneItems = clone['items'] as unknown[];
    const inputItems = input['items'] as unknown[];
    expect(cloneItems).not.toBe(inputItems);
    expect(cloneItems[0]).not.toBe(inputItems[0]);
    expect(cloneItems[1]).not.toBe(inputItems[1]);
  });

  it('returns primitives as-is', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(null)).toBe(null);
  });

  it('clones empty objects', () => {
    const clone = deepClone({});

    expect(clone).toEqual({});
    expect(clone).not.toBe({});
  });

  it('clones empty arrays', () => {
    const clone = deepClone([]);

    expect(clone).toEqual([]);
  });

  it('clones nested arrays inside objects', () => {
    const input = {
      a: [
        [1, 2],
        [3, 4],
      ],
    };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    const cloneA = clone['a'] as unknown[][];
    const inputA = input['a'] as unknown[][];
    expect(cloneA).not.toBe(inputA);
    expect(cloneA[0]).not.toBe(inputA[0]);
  });

  it('clones objects inside arrays', () => {
    const input = [{ a: 1 }, { b: 2 }];
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone[0]).not.toBe(input[0]);
    expect(clone[1]).not.toBe(input[1]);
  });

  it('returns non-plain objects as-is when isPlainObject returns false', () => {
    vi.mocked(isPlainObject).mockReturnValue(false);
    class Custom {
      value = 42;
    }
    const custom = new Custom();

    const clone = deepClone(custom);

    expect(clone).toBe(custom);
  });

  it('handles mixed nested structures', () => {
    const input = {
      str: 'hello',
      num: 42,
      arr: [1, { nested: true }],
      obj: { deep: { value: 'x' } },
      nil: null,
    };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone['arr']).not.toBe(input['arr']);
    expect(clone['obj']).not.toBe(input['obj']);
  });

  it('filters out unsafe keys to prevent prototype pollution', () => {
    const input = JSON.parse(
      '{"__proto__": {"polluted": true}, "constructor": {"polluted": true}, "prototype": {"polluted": true}, "safe": "value"}',
    );

    const clone = deepClone(input) as Record<string, unknown>;

    expect(clone['safe']).toBe('value');
    expect(Object.prototype.hasOwnProperty.call(clone, '__proto__')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(clone, 'constructor')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(clone, 'prototype')).toBe(
      false,
    );
  });
});
