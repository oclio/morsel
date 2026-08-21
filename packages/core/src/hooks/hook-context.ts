import type { HookContext } from '@/hooks/types';
import type { ResolvedOptions } from '@/store/assert-name';

/**
 * Build a fresh HookContext from resolved options.
 *
 * Stateless — a new context is created for each merge.
 */
export function createHookContext(options: ResolvedOptions): HookContext {
  return {
    cwd: options.cwd,
    envName: options.envName,
  };
}
