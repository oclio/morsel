import { MorselError } from '@/errors/error';
import { WriteError } from '@/errors/write-error';
import type { MutationOperation } from '@/writer/write-config';

describe('WriteError', () => {
  const mutation: MutationOperation = {
    path: 'server.port',
    value: 8080,
  };

  it('extends MorselError with EWRITE code', () => {
    const error = new WriteError(
      '/path/config.json',
      mutation,
      new Error('write failed'),
    );

    expect(error).toBeInstanceOf(MorselError);
    expect(error.name).toBe('WriteError');
    expect(error.code).toBe('EWRITE');
    expect(error.path).toBe('/path/config.json');
  });

  it('stores filePath and mutation', () => {
    const error = new WriteError(
      '/path/config.json',
      mutation,
      new Error('write failed'),
    );

    expect(error.filePath).toBe('/path/config.json');
    expect(error.mutation).toBe(mutation);
  });

  it('preserves cause', () => {
    const cause = new Error('disk full');
    const error = new WriteError('/path/config.json', mutation, cause);

    expect(error.cause).toBe(cause);
  });

  it('formats message with code and path', () => {
    const error = new WriteError(
      '/path/config.json',
      mutation,
      new Error('write failed'),
    );

    expect(error.message).toBe(
      'morsel: EWRITE — write failed (/path/config.json)',
    );
  });

  it('supports delete mutations', () => {
    const deleteMutation: MutationOperation = {
      path: 'server.port',
      isDelete: true,
    };
    const error = new WriteError(
      '/path/config.json',
      deleteMutation,
      new Error('write failed'),
    );

    expect(error.mutation.isDelete).toBe(true);
  });
});
