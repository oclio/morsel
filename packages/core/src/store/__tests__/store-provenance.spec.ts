import { resolveProvenance } from '@/store/store-provenance';
import type { MorselLayer } from '@/store/types';

function layer(
  source: MorselLayer['source'],
  config: Record<string, unknown>,
  path?: string,
  hookName?: string,
): MorselLayer {
  return {
    source,
    config,
    path,
    exists: true,
    extendsPaths: [],
    ...(hookName !== undefined && { hookName }),
  };
}

describe('resolveProvenance', () => {
  it('returns undefined when key is absent from all layers', () => {
    const result = resolveProvenance(
      [layer('defaults', { port: 3000 })],
      'missing',
    );

    expect(result).toBeUndefined();
  });

  it('returns winner from defaults with empty overridden chain', () => {
    const result = resolveProvenance(
      [layer('defaults', { port: 3000 })],
      'port',
    );

    expect(result).toStrictEqual({
      value: 3000,
      source: 'defaults',
      file: undefined,
      overridden: [],
    });
  });

  it('traverses layers in reverse and populates overridden chain', () => {
    const layers = [
      layer('defaults', { port: 3000 }),
      layer('global', { port: 5000 }, '/global/myapp.config.json'),
      layer('project', { port: 8080 }, '/project/myapp.config.json'),
    ];

    const result = resolveProvenance(layers, 'port');

    expect(result).toStrictEqual({
      value: 8080,
      source: 'project',
      file: '/project/myapp.config.json',
      overridden: [
        {
          value: 5000,
          source: 'global',
          file: '/global/myapp.config.json',
        },
        { value: 3000, source: 'defaults', file: undefined },
      ],
    });
  });

  it('populates hookName for hook layers', () => {
    const layers = [
      layer('defaults', { port: 3000 }),
      layer('hook', { port: 4000 }, undefined, 'feature-flags'),
    ];

    const result = resolveProvenance(layers, 'port');

    expect(result).toStrictEqual({
      value: 4000,
      source: 'hook',
      file: undefined,
      hookName: 'feature-flags',
      overridden: [{ value: 3000, source: 'defaults', file: undefined }],
    });
  });

  it('skips layers where the key is absent', () => {
    const layers = [
      layer('defaults', { port: 3000 }),
      layer('global', {}, '/global/myapp.config.json'),
      layer('project', { port: 8080 }, '/project/myapp.config.json'),
    ];

    const result = resolveProvenance(layers, 'port');

    expect(result?.overridden).toStrictEqual([
      { value: 3000, source: 'defaults', file: undefined },
    ]);
  });

  it('returns full object value without recursive descent', () => {
    const server = { host: 'localhost', port: 3000 };
    const layers = [layer('defaults', { server })];

    const result = resolveProvenance(layers, 'server');

    expect(result?.value).toEqual({ host: 'localhost', port: 3000 });
    expect(result?.source).toBe('defaults');
  });

  it('accepts array path input', () => {
    const layers = [layer('defaults', { server: { host: 'localhost' } })];

    const result = resolveProvenance(layers, ['server', 'host']);

    expect(result?.value).toBe('localhost');
    expect(result?.source).toBe('defaults');
  });
});
