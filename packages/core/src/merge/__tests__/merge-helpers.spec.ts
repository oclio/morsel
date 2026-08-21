import { isPlainObject } from '@/merge/merge-helpers';

describe('isPlainObject', () => {
  it.each([
    { value: { a: 1 }, label: 'plain object' },
    { value: {}, label: 'empty object' },
    { value: { nested: { inner: 1 } }, label: 'nested object' },
  ])('returns true for $label', ({ value }) => {
    expect(isPlainObject(value)).toBe(true);
  });

  it.each([
    { value: null, label: 'null' },
    { value: undefined, label: 'undefined' },
    { value: 'string', label: 'string' },
    { value: 42, label: 'number' },
    { value: true, label: 'boolean' },
    { value: [1, 2], label: 'array' },
    { value: (): void => {}, label: 'function' },
    { value: new Date(), label: 'Date instance' },
    { value: new Map(), label: 'Map instance' },
    { value: new Set(), label: 'Set instance' },
    { value: /regex/, label: 'RegExp instance' },
    { value: new Error('msg'), label: 'Error instance' },
  ])('returns false for $label', ({ value }) => {
    expect(isPlainObject(value)).toBe(false);
  });

  it('returns true for object with null prototype', () => {
    const object = Object.create(null);
    object['foo'] = 'bar';

    expect(isPlainObject(object)).toBe(true);
  });

  it('returns false for class instance', () => {
    class Custom {
      foo = 'bar';
    }

    expect(isPlainObject(new Custom())).toBe(false);
  });
});
