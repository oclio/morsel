import { createMockResolvedOptions } from '@oclio/test-helpers';

import { createHookContext } from '@/hooks/hook-context';
import type { ResolvedOptions } from '@/store/boot/assert-name';

function makeOptions(
  overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return createMockResolvedOptions(overrides) as ResolvedOptions;
}

describe('createHookContext', () => {
  const noop = (): void => {};

  it.each<{
    property: 'cwd' | 'envName';
    overrides: Partial<ResolvedOptions>;
    expected: unknown;
  }>([
    { property: 'cwd', overrides: {}, expected: '/project' },
    { property: 'envName', overrides: {}, expected: 'test' },
    {
      property: 'envName',
      overrides: { envName: undefined },
      expected: undefined,
    },
    {
      property: 'cwd',
      overrides: { cwd: '/custom/path' },
      expected: '/custom/path',
    },
  ])(
    'sets $property to $expected with given overrides',
    ({ property, overrides, expected }) => {
      const context = createHookContext(makeOptions(overrides), noop);

      expect(context[property]).toBe(expected);
    },
  );

  it('creates a fresh context object each call', () => {
    const options = makeOptions();

    const context1 = createHookContext(options, noop);
    const context2 = createHookContext(options, noop);

    expect(context1).not.toBe(context2);
    expect(context1).toEqual(context2);
  });

  it('passes triggerRemerge into context', () => {
    const triggerRemerge = vi.fn();
    const context = createHookContext(makeOptions(), triggerRemerge);

    expect(context.triggerRemerge).toBe(triggerRemerge);
  });
});
