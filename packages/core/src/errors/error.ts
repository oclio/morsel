/**
 * Error codes used by morsel to distinguish failure categories.
 *
 * - `EIO` — filesystem errors (EACCES, EBUSY, EMFILE, disk full)
 * - `EPARSE` — invalid content (broken JSON/YAML/etc.)
 * - `ENOPLUGIN` — no format plugin found for the file extension
 * - `EVALIDATE` — validation failure (plugin rejection or type mismatch)
 * - `ECYCLE` — circular `extends` detected
 * - `EHOOK` — hook lifecycle failure (hook.load threw)
 * - `EWRITE` — write/mutation failure (I/O or serialize error during writeConfig)
 */
export type ErrorCode =
  'EIO' | 'EPARSE' | 'ENOPLUGIN' | 'EVALIDATE' | 'ECYCLE' | 'EHOOK' | 'EWRITE';

/**
 * Base error thrown by morsel on fs, parse, plugin, validation, or cycle failures.
 *
 * In one-shot mode (`loadConfig`/`loadConfigSync`): thrown to the consumer.
 * In watch mode (`watchConfig`): thrown at boot if the initial load fails;
 * caught internally on re-merge and routed to `onDebug`/stderr.
 *
 * Programming errors (`name` missing, `on()` after `stop()`) throw
 * `TypeError`/`Error` — not `MorselError`.
 */
export class MorselError extends Error {
  readonly path: string | undefined;
  readonly code: ErrorCode;
  override readonly cause: NodeJS.ErrnoException | Error;

  constructor(
    path: string | undefined,
    code: ErrorCode,
    cause: NodeJS.ErrnoException | Error,
  ) {
    const message = cause.message;
    const suffix = path === undefined ? '' : ` (${path})`;
    super(`morsel: ${code} — ${message}${suffix}`);

    this.name = 'MorselError';
    this.path = path;
    this.code = code;
    this.cause = cause;
  }
}
