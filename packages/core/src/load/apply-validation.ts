import { ValidationError } from '@/errors/validation-error';
import type { ValidationPlugin } from '@/plugins/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Apply validation plugins to the merged config, in order.
 *
 * Each plugin receives the config and returns a (potentially transformed) copy.
 * If a plugin throws, the error is wrapped into `ValidationError`.
 *
 * Plugins are applied sequentially — the output of one feeds the next.
 * If no plugins are provided, the config is returned as-is.
 *
 * @param config - The merged config to validate.
 * @param plugins - Ordered list of validation plugins.
 * @returns The validated (and possibly transformed) config.
 * @throws ValidationError When a plugin rejects the config.
 */
export function applyValidation(
  config: ConfigRecord,
  plugins: readonly ValidationPlugin[],
): ConfigRecord {
  let result = config;
  for (const plugin of plugins) {
    try {
      result = plugin.validate(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError({
        [plugin.name]: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}
