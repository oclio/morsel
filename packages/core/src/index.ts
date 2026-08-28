export type { ErrorCode } from '@/errors/error';
export { MorselError } from '@/errors/error';
export { NoPluginError } from '@/errors/no-plugin-error';
export { ValidationError } from '@/errors/validation-error';
export type {
  Hook,
  HookContext,
  HookLifecycle,
  LayerHook,
  LayerWatchableHook,
} from '@/hooks/types';
export type { ConfigMutability } from '@/load/merge-layers';
export type { DebugCallback } from '@/load/resolve-env';
export type { LayerSource } from '@/load/resolve-layer';
export type { ArrayMergeStrategy } from '@/merge/deep-merge';
export { deepMerge } from '@/merge/deep-merge';
export type { ChangeCategory, KeyChange } from '@/merge/diff-keys';
export { diffKeys } from '@/merge/diff-keys';
export { interpolate } from '@/merge/interpolate';
export type { PathSegment } from '@/paths/parse-path';
export { parsePath, validatePath } from '@/paths/parse-path';
export { getPathValue } from '@/paths/path-access';
export type { ResolvedPaths, ResolvePathsOptions } from '@/paths/resolve-paths';
export { resolvePaths } from '@/paths/resolve-paths';
export { jsonPlugin } from '@/plugins/json-plugin';
export type { FormatPlugin, ValidationPlugin } from '@/plugins/types';
export { loadConfig, loadConfigSync } from '@/store/boot/load-config';
export { watchConfig } from '@/store/boot/watch-config';
export type {
  ChangeEvent,
  ConfigRecord,
  ConfigResult,
  Listener,
  ListenerOptions,
  MorselLayer,
  MorselOptions,
  MorselStore,
  Provenance,
  ProvenanceOverride,
  WatchOptions,
} from '@/store/types';
export { defineConfig, mergeConfig } from '@/utils/define-config';
export { initConfig } from '@/utils/init-config';
export type { WatcherEntry, WatcherRegistry } from '@/watch/watcher-registry';
export { clearRegistry, getRegistry } from '@/watch/watcher-registry';
