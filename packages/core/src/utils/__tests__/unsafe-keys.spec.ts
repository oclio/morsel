import { describe, expect, it } from 'vitest';

import { isUnsafeKey, UNSAFE_KEYS } from '@/utils/unsafe-keys';

describe('UNSAFE_KEYS', () => {
  it('contains __proto__, constructor, and prototype', () => {
    expect(UNSAFE_KEYS.has('__proto__')).toBe(true);
    expect(UNSAFE_KEYS.has('constructor')).toBe(true);
    expect(UNSAFE_KEYS.has('prototype')).toBe(true);
  });

  it('does not contain safe keys', () => {
    expect(UNSAFE_KEYS.has('foo')).toBe(false);
    expect(UNSAFE_KEYS.has('toString')).toBe(false);
    expect(UNSAFE_KEYS.has('')).toBe(false);
  });
});

describe('isUnsafeKey', () => {
  it.each(['__proto__', 'constructor', 'prototype'])(
    'returns true for %s',
    (key) => {
      expect(isUnsafeKey(key)).toBe(true);
    },
  );

  it.each(['foo', 'bar', 'toString', 'valueOf', ''])(
    'returns false for %s',
    (key) => {
      expect(isUnsafeKey(key)).toBe(false);
    },
  );
});
