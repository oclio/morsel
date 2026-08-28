import { createMockStoreState } from '@oclio/test-helpers';

import { createArrayMethods } from '@/store/store-array-methods';
import type { StoreState } from '@/store/store-state';

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return createMockStoreState<T>({
    _config: { foo: 'bar' } as unknown as T,
    options: { hooks: [] },
    ...overrides,
  }) as unknown as StoreState<T>;
}

describe('createArrayMethods — read-only array methods', () => {
  describe('indexOf and lastIndexOf', () => {
    it.each([
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 0,
      },
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 2,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
    ])(
      '$method returns $expected for $path with value $value',
      ({ method, config, path, value, expected }) => {
        const state = createState({
          _config: config as never,
        });
        const methods = createArrayMethods(state);

        const result =
          method === 'indexOf'
            ? methods.indexOf(path, value)
            : methods.lastIndexOf(path, value);

        expect(result).toBe(expected);
      },
    );

    it.each([
      { method: 'indexOf' as const, config: { name: 'morsel' } },
      { method: 'lastIndexOf' as const, config: { name: 'morsel' } },
    ])(
      '$method throws MorselError(EVALIDATE) on non-array key',
      ({ method, config }) => {
        const state = createState({
          _config: config as never,
        });
        const methods = createArrayMethods(state);

        expect(() =>
          method === 'indexOf'
            ? methods.indexOf('name', 'morsel')
            : methods.lastIndexOf('name', 'morsel'),
        ).toThrow(
          expect.objectContaining({
            name: 'MorselError',
            code: 'EVALIDATE',
            message: expect.stringContaining('"name" is not an array'),
          }),
        );
      },
    );
  });
});
