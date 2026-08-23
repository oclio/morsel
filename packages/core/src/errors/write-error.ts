import { MorselError } from '@/errors/morsel-error';
import type { MutationOperation } from '@/writer/write-config';

/**
 * Thrown when a write/mutation fails (I/O or serialize error during writeConfig).
 *
 * Carries the target file path and the mutation that was attempted,
 * so consumers can retry or report precisely what failed.
 */
export class MorselWriteError extends MorselError {
  readonly filePath: string;
  readonly mutation: MutationOperation;

  constructor(
    filePath: string,
    mutation: MutationOperation,
    cause: NodeJS.ErrnoException | Error,
  ) {
    super(filePath, 'EWRITE', cause);
    this.name = 'MorselWriteError';
    this.filePath = filePath;
    this.mutation = mutation;
  }
}
