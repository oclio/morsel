import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { processConfig } from '@/load/process-config';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { interpolate } from '@/merge/interpolate';
import { deepClone } from '@/utils/deep-clone';

vi.mock('@/load/apply-validation', () => ({
  applyValidation: vi.fn(),
}));
vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
  mergeLayers: vi.fn(),
}));
vi.mock('@/merge/interpolate', () => ({
  interpolate: vi.fn(),
}));
vi.mock('@/utils/deep-clone', () => ({
  deepClone: vi.fn(),
}));

const mergedConfig = { port: 3000 };
const interpolatedConfig = { port: 3000, interpolated: true };
const validatedConfig = { port: 3000, interpolated: true, validated: true };
const finalConfig = {
  port: 3000,
  interpolated: true,
  validated: true,
  frozen: true,
};
const clonedConfig = {
  port: 3000,
  interpolated: true,
  validated: true,
  cloned: true,
};

function makeLayers(): ResolvedLayer[] {
  return [
    {
      source: 'defaults',
      path: undefined,
      exists: true,
      config: { port: 3000 },
      extendsPaths: [],
    },
  ];
}

describe('processConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mergeLayers).mockReturnValue(mergedConfig);
    vi.mocked(interpolate).mockReturnValue(interpolatedConfig);
    vi.mocked(applyValidation).mockReturnValue(validatedConfig);
    vi.mocked(applyMutability).mockReturnValue(finalConfig);
    vi.mocked(deepClone).mockReturnValue(clonedConfig);
  });

  it('calls mergeLayers with layers and arrayMerge', () => {
    const layers = makeLayers();

    processConfig(layers, 'concat', [], 'frozen');

    expect(mergeLayers).toHaveBeenCalledWith(layers, 'concat');
  });

  it('calls interpolate with the merged result', () => {
    processConfig(makeLayers(), 'replace', [], 'frozen');

    expect(interpolate).toHaveBeenCalledWith(mergedConfig);
  });

  it('calls applyValidation with the interpolated result and plugins', () => {
    const plugins = [{ name: 'p', validate: (c: unknown) => c }] as never;

    processConfig(makeLayers(), 'replace', plugins, 'frozen');

    expect(applyValidation).toHaveBeenCalledWith(interpolatedConfig, plugins);
  });

  it('calls applyMutability with the validated result and mutability', () => {
    processConfig(makeLayers(), 'replace', [], 'frozen');

    expect(applyMutability).toHaveBeenCalledWith(validatedConfig, 'frozen');
  });

  it('returns config from applyMutability', () => {
    const result = processConfig(makeLayers(), 'replace', [], 'frozen');

    expect(result.config).toBe(finalConfig);
  });

  it('returns validated from applyValidation', () => {
    const result = processConfig(makeLayers(), 'replace', [], 'frozen');

    expect(result.validated).toBe(validatedConfig);
  });

  it('returns lastConfig as validated ref (no clone) when mutability is frozen', () => {
    const result = processConfig(makeLayers(), 'replace', [], 'frozen');

    expect(result.lastConfig).toBe(validatedConfig);
    expect(deepClone).not.toHaveBeenCalled();
  });

  it('returns lastConfig as deepClone when mutability is mutable', () => {
    const result = processConfig(makeLayers(), 'replace', [], 'mutable');

    expect(result.lastConfig).toBe(clonedConfig);
    expect(deepClone).toHaveBeenCalledWith(validatedConfig);
  });
});
