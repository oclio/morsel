import { createMockStoreState } from '@oclio/test-helpers';

import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
import { emitChanges } from '@/store/reactive/emit-changes';
import {
  applyOptimisticUpdate,
  applyOptimisticUpdateSilent,
  rollbackOptimisticUpdate,
} from '@/store/store-optimistic-update';
import type { StoreState } from '@/store/store-state';
import type { MorselLayer } from '@/store/types';
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
vi.mock('@/store/reactive/emit-changes', () => ({
  emitChanges: vi.fn(),
}));
vi.mock('@/utils/deep-clone', () => ({
  deepClone: vi.fn(),
}));

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return createMockStoreState<T>({
    _config: { foo: 'bar' } as unknown as T,
    _layers: [
      {
        source: 'project',
        path: '/project/config.json',
        config: {},
        exists: true,
        extendsPaths: [],
      },
    ],
    ...overrides,
  }) as unknown as StoreState<T>;
}

describe('store-optimistic-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyValidation).mockImplementation((config) => config);
    vi.mocked(applyMutability).mockImplementation((config) => config);
    vi.mocked(mergeLayers).mockImplementation((layers) => {
      let merged = {};
      for (const layer of layers) {
        merged = { ...merged, ...layer.config };
      }
      return merged;
    });
    vi.mocked(interpolate).mockImplementation((config) => config);
    vi.mocked(deepClone).mockImplementation(
      (config) => structuredClone(config) as Record<string, unknown>,
    );
    vi.mocked(emitChanges).mockImplementation(() => {});
  });

  describe('applyOptimisticUpdate', () => {
    it('returns false when no layer matches target files', () => {
      const state = createState();

      const result = applyOptimisticUpdate(
        state,
        'mutable',
        ['/other.json'],
        () => true,
      );

      expect(result).toBe(false);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('returns false when mutation returns false', () => {
      const state = createState();

      const result = applyOptimisticUpdate(
        state,
        'mutable',
        ['/project/config.json'],
        () => false,
      );

      expect(result).toBe(false);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('updates config optimistically and emits change events', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      applyOptimisticUpdate(
        state,
        'mutable',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(emitChanges).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        state.listeners,
        state.wildcardListeners,
      );
    });

    it('freezes config when mutability is frozen', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      applyOptimisticUpdate(
        state,
        'frozen',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(applyMutability).toHaveBeenCalledWith(
        expect.any(Object),
        'frozen',
      );
      expect(state.lastConfig).toBe(state._config);
    });

    it('clones lastConfig when mutability is mutable', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      applyOptimisticUpdate(
        state,
        'mutable',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(deepClone).toHaveBeenCalled();
      expect(state.lastConfig).not.toBe(state._config);
    });
  });

  describe('applyOptimisticUpdateSilent', () => {
    it('returns false when no layer matches target files', () => {
      const state = createState();

      const result = applyOptimisticUpdateSilent(
        state,
        'mutable',
        ['/other.json'],
        () => true,
      );

      expect(result).toBe(false);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('returns false when mutation returns false', () => {
      const state = createState();

      const result = applyOptimisticUpdateSilent(
        state,
        'mutable',
        ['/project/config.json'],
        () => false,
      );

      expect(result).toBe(false);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('updates config silently without emitting change events', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      const result = applyOptimisticUpdateSilent(
        state,
        'mutable',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(result).toBe(true);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('freezes config when mutability is frozen', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      applyOptimisticUpdateSilent(
        state,
        'frozen',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(applyMutability).toHaveBeenCalledWith(
        expect.any(Object),
        'frozen',
      );
      expect(state.lastConfig).toBe(state._config);
    });

    it('clones lastConfig when mutability is mutable', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      applyOptimisticUpdateSilent(
        state,
        'mutable',
        ['/project/config.json'],
        (config) => {
          (config as Record<string, unknown>)['server'] = { port: 8080 };
          return true;
        },
      );

      expect(deepClone).toHaveBeenCalled();
      expect(state.lastConfig).not.toBe(state._config);
    });
  });

  describe('rollbackOptimisticUpdate', () => {
    it('skips rollback when config changed during await (concurrent re-merge)', () => {
      const state = createState({
        _config: { server: { port: 8080 } } as never,
      });
      const previousLayers = state._layers;
      const previousConfig = { server: { port: 3000 } } as never;
      const previousLastConfig = { server: { port: 3000 } };
      // Simulate concurrent re-merge replacing _config
      const mutatedConfig = { server: { port: 9999 } } as never;
      state._config = mutatedConfig;

      rollbackOptimisticUpdate(
        state,
        previousLayers,
        previousConfig,
        previousLastConfig,
        { server: { port: 8080 } } as never, // not equal to current _config
      );

      expect(state._config).toBe(mutatedConfig);
      expect(emitChanges).not.toHaveBeenCalled();
    });

    it('rolls back config and emits rollback events', () => {
      const previousConfig = { server: { port: 3000 } } as never;
      const previousLastConfig = { server: { port: 3000 } };
      const previousLayers: MorselLayer[] = [
        {
          source: 'project',
          path: '/project/config.json',
          config: {},
          exists: true,
          extendsPaths: [],
        },
      ];
      const state = createState({
        _config: { server: { port: 8080 } } as never,
        lastConfig: { server: { port: 8080 } },
      });
      const mutatedConfig = state._config;

      rollbackOptimisticUpdate(
        state,
        previousLayers,
        previousConfig,
        previousLastConfig,
        mutatedConfig,
      );

      expect(state._config).toBe(previousConfig);
      expect(state._layers).toBe(previousLayers);
      expect(state.lastConfig).toBe(previousLastConfig);
      expect(emitChanges).toHaveBeenCalledWith(
        mutatedConfig,
        previousLastConfig,
        state.listeners,
        state.wildcardListeners,
      );
    });
  });
});
