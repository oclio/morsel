export type { MorselErrorCode } from '@/errors/morsel-error';
export { MorselError } from '@/errors/morsel-error';
export { MorselNoPluginError } from '@/errors/no-plugin-error';
export { MorselValidationError } from '@/errors/validation-error';
export type {
  HookContext,
  HookLifecycle,
  MorselHook,
  MorselWatchableHook,
} from '@/hooks/types';
export type { ConfigMutability } from '@/load/merge-layers';
export type { DebugCallback } from '@/load/resolve-env';
export type { LayerSource } from '@/load/resolve-layer';
export type { ArrayMergeStrategy } from '@/merge/deep-merge';
export { deepMerge } from '@/merge/deep-merge';
export type { ChangeCategory, KeyChange } from '@/merge/diff-keys';
export { diffKeys } from '@/merge/diff-keys';
export { flatten } from '@/merge/flatten';
export { dotifyObject } from '@/paths/dotify';
export type { PathSegment } from '@/paths/parse-path';
export { parsePath, validatePath } from '@/paths/parse-path';
export {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';
export type { ResolvedPaths, ResolvePathsOptions } from '@/paths/resolve-paths';
export { resolvePaths } from '@/paths/resolve-paths';
export { jsonPlugin } from '@/plugins/json-plugin';
export type {
  MorselFormatPlugin,
  MorselValidationPlugin,
} from '@/plugins/types';
export { loadConfig, loadConfigSync } from '@/store/load-config';
export type {
  ConfigRecord,
  ConfigResult,
  Listener,
  MorselChangeEvent,
  MorselLayer,
  MorselOptions,
  MorselStore,
  WatchOptions,
} from '@/store/types';
export { watchConfig } from '@/store/watch-config';
export { defineConfig, mergeConfig } from '@/utils/define-config';
export { initConfig } from '@/utils/init-config';
export type { WatcherEntry, WatcherRegistry } from '@/watch/watcher-registry';
export { clearRegistry, getRegistry } from '@/watch/watcher-registry';
