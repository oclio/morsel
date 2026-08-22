import { describe, expect, it } from 'vitest';

import { main } from '../index';

describe('e2e smoke — accessors plugin entry point', () => {
  it('exports a callable main function', () => {
    expect(typeof main).toBe('function');
    expect(() => main()).not.toThrow();
  });
});
