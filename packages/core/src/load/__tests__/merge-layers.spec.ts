import { createMockLayer } from '@oclio/test-helpers';

import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { deepMergeInPlace } from '@/merge/deep-merge';
import { deepFreeze } from '@/utils/deep-freeze';

vi.mock('@/merge/deep-merge', () => ({
  deepMergeInPlace: vi.fn(
    (base: Record<string, unknown>, override: Record<string, unknown>) => ({
      ...base,
      ...override,
    }),
  ),
}));
vi.mock('@/utils/deep-freeze', () => ({
  deepFreeze: vi.fn((value: Record<string, unknown>) =>
    Object.freeze({ ...value }),
  ),
}));

function makeLayer(
  source: ResolvedLayer['source'],
  config: Record<string, unknown>,
): ResolvedLayer {
  return createMockLayer({
    source,
    path: `/fake/${source}.json`,
    config,
  }) as ResolvedLayer;
}

describe('applyMutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the same object reference for mutable', () => {
    const config = { foo: 'bar' };

    const result = applyMutability(config, 'mutable');

    expect(result).toBe(config);
    expect(deepFreeze).not.toHaveBeenCalled();
  });

  it('calls deepFreeze for frozen', () => {
    const config = { foo: 'bar' };

    applyMutability(config, 'frozen');

    expect(deepFreeze).toHaveBeenCalledWith(config);
  });

  it('returns the result of deepFreeze for frozen', () => {
    const config = { foo: 'bar' };
    const frozen = { frozen: true } as never;
    vi.mocked(deepFreeze).mockReturnValue(frozen);

    const result = applyMutability(config, 'frozen');

    expect(result).toBe(frozen);
  });
});

describe('mergeLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when all layers have empty configs', () => {
    const layers = [
      makeLayer('defaults', {}),
      makeLayer('global', {}),
      makeLayer('project', {}),
      makeLayer('overrides', {}),
    ];

    const result = mergeLayers(layers, 'replace');

    expect(result).toEqual({});
  });

  it('calls deepMergeInPlace for each layer in order', () => {
    const layers = [
      makeLayer('defaults', { a: 1 }),
      makeLayer('project', { b: 2 }),
    ];

    mergeLayers(layers, 'replace');

    expect(deepMergeInPlace).toHaveBeenCalledTimes(2);
    expect(deepMergeInPlace).toHaveBeenCalledWith({}, { a: 1 }, 'replace');
    expect(deepMergeInPlace).toHaveBeenCalledWith(
      { a: 1 },
      { b: 2 },
      'replace',
    );
  });

  it('passes arrayMerge strategy to deepMergeInPlace', () => {
    const layers = [makeLayer('defaults', { a: 1 })];

    mergeLayers(layers, 'concat');

    expect(deepMergeInPlace).toHaveBeenCalledWith({}, { a: 1 }, 'concat');
  });

  it('returns the final merged result', () => {
    const layers = [
      makeLayer('defaults', { a: 1 }),
      makeLayer('project', { b: 2 }),
    ];

    const result = mergeLayers(layers, 'replace');

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles single layer', () => {
    const layers = [makeLayer('defaults', { foo: 'bar' })];

    const result = mergeLayers(layers, 'replace');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('handles empty layers array', () => {
    const result = mergeLayers([], 'replace');

    expect(result).toEqual({});
  });
});
