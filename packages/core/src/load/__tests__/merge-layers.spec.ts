import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { deepMerge } from '@/merge/deep-merge';

vi.mock('@/merge/deep-merge', () => ({
  deepMerge: vi.fn(
    (base: Record<string, unknown>, override: Record<string, unknown>) => ({
      ...base,
      ...override,
    }),
  ),
}));

function makeLayer(
  source: ResolvedLayer['source'],
  config: Record<string, unknown>,
): ResolvedLayer {
  return {
    source,
    path: `/fake/${source}.json`,
    exists: true,
    config,
    extendsPaths: [],
  };
}

describe('applyMutability', () => {
  it.each([
    { name: 'frozen', mutability: 'frozen' as const },
    { name: 'mutable', mutability: 'mutable' as const },
  ])('returns a value for mutability $name', ({ mutability }) => {
    const config = { foo: 'bar' };

    const result = applyMutability(config, mutability);

    expect(result).toBeDefined();
    expect(result.foo).toBe('bar');
  });

  it('returns the same object reference for mutable', () => {
    const config = { foo: 'bar' };

    const result = applyMutability(config, 'mutable');

    expect(result).toBe(config);
  });

  it('returns a frozen object for frozen', () => {
    const config = { foo: 'bar', nested: { a: 1 } };

    const result = applyMutability(config, 'frozen');

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nested)).toBe(true);
  });

  it('deep freezes nested objects', () => {
    const config = { a: { b: { c: 1 } } };

    const result = applyMutability(config, 'frozen');

    expect(Object.isFrozen(result.a)).toBe(true);
    expect(Object.isFrozen(result.a.b)).toBe(true);
  });

  it('does not freeze function values in deepFreeze', () => {
    const function_ = (): void => {};
    const config = { callback: function_ };

    const result = applyMutability(config, 'frozen');

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.callback)).toBe(false);
  });

  it('handles circular references in deepFreeze without stack overflow', () => {
    const config: Record<string, unknown> = { foo: 'bar' };
    config['self'] = config;

    const result = applyMutability(config, 'frozen');

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not re-freeze already frozen objects', () => {
    const config = { foo: 'bar' };
    Object.freeze(config);

    const result = applyMutability(config, 'frozen');

    expect(Object.isFrozen(result)).toBe(true);
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

  it('calls deepMerge for each layer in order', () => {
    const layers = [
      makeLayer('defaults', { a: 1 }),
      makeLayer('project', { b: 2 }),
    ];

    mergeLayers(layers, 'replace');

    expect(deepMerge).toHaveBeenCalledTimes(2);
    expect(deepMerge).toHaveBeenCalledWith({}, { a: 1 }, 'replace');
    expect(deepMerge).toHaveBeenCalledWith({ a: 1 }, { b: 2 }, 'replace');
  });

  it('passes arrayMerge strategy to deepMerge', () => {
    const layers = [makeLayer('defaults', { a: 1 })];

    mergeLayers(layers, 'concat');

    expect(deepMerge).toHaveBeenCalledWith({}, { a: 1 }, 'concat');
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
