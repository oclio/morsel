/**
 * Format plugin contract — parses file content into a config record.
 *
 * Each plugin handles one or more file extensions (ex: `.json`, `.yaml`).
 * The core handles `extends` and `$env` — the plugin only parses raw content.
 *
 * If parsing fails, the plugin throws; core wraps it into `MorselError` (code `EPARSE`).
 */
export interface MorselFormatPlugin {
  /**
  Unique plugin name, ex: "json", "yaml".
  */
  readonly name: string;
  /**
  Handled extensions, ex: [".json"]. Matched against path.extname(filePath).
  */
  readonly extensions: readonly string[];
  /**
   * Parse file content into a config record.
   * Throw on invalid content — core wraps into MorselError (code EPARSE).
   * Does not handle extends or $env — core manages those.
   */
  parse(content: string, filePath: string): Record<string, unknown>;
}

/**
 * Validation plugin contract — validates and optionally transforms the merged config.
 *
 * Applied post-merge, in order. Each plugin can validate and transform the config
 * (coercion, defaults, strip). If a plugin throws, core wraps it into
 * `MorselValidationError`.
 *
 * The plugin must return a new reference — do not mutate the argument.
 * The input is not guaranteed mutable (a previous plugin may return a frozen object).
 */
export interface MorselValidationPlugin {
  /**
  Unique plugin name, ex: "zod", "valibot".
  */
  readonly name: string;
  /**
   * Validate and optionally transform the final config (post-merge).
   * Return the config (potentially modified) if valid.
   * Throw if invalid — core wraps into MorselValidationError with the issues.
   * Strict/flex (accept extra keys, strip, coerce) is the plugin's responsibility.
   */
  validate(config: Record<string, unknown>): Record<string, unknown>;
}
