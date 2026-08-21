import { MorselError } from '@/errors/morsel-error';

/**
 * Thrown when a validation plugin rejects the merged config.
 *
 * Validation is post-merge — there is no single source file, so `path`
 * is always `undefined`. The consumer distinguishes via `instanceof`
 * or `e.code === 'EVALIDATE'`.
 */
export class MorselValidationError extends MorselError {
  /**
   * Map of dotted key to human-readable message.
   * Example: `tools.eslint` maps to "expected boolean, received string".
   */
  readonly issues: Record<string, string>;

  constructor(issues: Record<string, string>) {
    const count = Object.keys(issues).length;
    const message = `validation failed (${count} issue${count === 1 ? '' : 's'})`;
    super(undefined, 'EVALIDATE', new Error(message));
    this.name = 'MorselValidationError';
    this.issues = issues;
  }
}
