import { getPathValue } from '@/paths/path-access';
import type { MorselLayer, StoreTarget } from '@/store/types';

/**
 * Result of resolving which layer and file path owns a given configuration key.
 */
export interface KeyOrigin {
  readonly layer: MorselLayer | undefined;
  readonly filePath: string | undefined;
  readonly isWritable: boolean;
  readonly exists: boolean;
}

/**
 * Determine which layer and file path owns a given path key.
 *
 * @param path - Normalized path string or segments.
 * @param layers - Current store layers (in cascade order).
 * @param explicitTarget - Optional target specified by the caller ('global' | 'project').
 * @returns The resolved KeyOrigin details.
 */
export function resolveKeyOrigin(
  path: string,
  layers: readonly MorselLayer[],
  explicitTarget?: StoreTarget,
): KeyOrigin {
  const projectLayer = layers.find((layer) => layer.source === 'project');
  const globalLayer = layers.find((layer) => layer.source === 'global');

  if (explicitTarget === 'global') {
    return {
      layer: globalLayer,
      filePath: globalLayer?.path,
      isWritable: true,
      exists:
        globalLayer !== undefined &&
        getPathValue(globalLayer.config, path) !== undefined,
    };
  }

  if (explicitTarget === 'project') {
    return {
      layer: projectLayer,
      filePath: projectLayer?.path,
      isWritable: true,
      exists:
        projectLayer !== undefined &&
        getPathValue(projectLayer.config, path) !== undefined,
    };
  }

  // Implicit target resolution: check closest layer with the key (project -> global)
  if (
    projectLayer !== undefined &&
    getPathValue(projectLayer.config, path) !== undefined
  ) {
    return {
      layer: projectLayer,
      filePath: projectLayer.path,
      isWritable: true,
      exists: true,
    };
  }

  if (
    globalLayer !== undefined &&
    getPathValue(globalLayer.config, path) !== undefined
  ) {
    return {
      layer: globalLayer,
      filePath: globalLayer.path,
      isWritable: true,
      exists: true,
    };
  }

  // Fallback to project layer (default closest file)
  return {
    layer: projectLayer,
    filePath: projectLayer?.path,
    isWritable: true,
    exists: false,
  };
}
