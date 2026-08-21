import { MorselError } from '@/errors/morsel-error';

describe('MorselError', () => {
  it('sets name to MorselError', () => {
    const error = new MorselError(
      '/path/config.json',
      'EIO',
      new Error('fail'),
    );

    expect(error.name).toBe('MorselError');
  });

  it('stores path property', () => {
    const error = new MorselError(
      '/path/config.json',
      'EIO',
      new Error('fail'),
    );

    expect(error.path).toBe('/path/config.json');
  });

  it('stores code property', () => {
    const error = new MorselError(
      '/path/config.json',
      'EPARSE',
      new Error('fail'),
    );

    expect(error.code).toBe('EPARSE');
  });

  it('preserves cause as NodeJS.ErrnoException when it has a string code', () => {
    const cause = Object.assign(new Error('fail'), { code: 'ENOENT' });
    const error = new MorselError('/path/config.json', 'EIO', cause);

    expect(error.cause).toBe(cause);
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('formats message with code and cause message and path', () => {
    const cause = new Error('ENOENT: not found');
    const error = new MorselError('/path/config.json', 'EIO', cause);

    expect(error.message).toBe(
      'morsel: EIO — ENOENT: not found (/path/config.json)',
    );
  });

  it('formats message without path when path is undefined', () => {
    const error = new MorselError(
      undefined,
      'EVALIDATE',
      new Error('bad config'),
    );

    expect(error.message).toBe('morsel: EVALIDATE — bad config');
  });

  it('formats message with cause message and path', () => {
    const error = new MorselError(
      '/path/config.json',
      'ECYCLE',
      new Error('cycle detected'),
    );

    expect(error.message).toBe(
      'morsel: ECYCLE — cycle detected (/path/config.json)',
    );
  });

  it('is an instance of Error', () => {
    const error = new MorselError('/path', 'EIO', new Error('fail'));

    expect(error).toBeInstanceOf(Error);
  });

  it('has a stack trace', () => {
    const error = new MorselError('/path', 'EIO', new Error('fail'));

    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('MorselError');
  });
});
