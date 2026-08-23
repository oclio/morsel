import type { MorselErrorCode } from '@/errors/morsel-error';
import { MorselError } from '@/errors/morsel-error';

describe('MorselError', () => {
  describe('properties', () => {
    it.each<{
      name: string;
      property: 'name' | 'path' | 'code';
      path: string | undefined;
      code: MorselErrorCode;
      expected: unknown;
    }>([
      {
        name: 'sets name to MorselError',
        property: 'name',
        path: '/path/config.json',
        code: 'EIO',
        expected: 'MorselError',
      },
      {
        name: 'stores path property',
        property: 'path',
        path: '/path/config.json',
        code: 'EIO',
        expected: '/path/config.json',
      },
      {
        name: 'stores code property',
        property: 'code',
        path: '/path/config.json',
        code: 'EPARSE',
        expected: 'EPARSE',
      },
    ])('$name', ({ property, path, code, expected }) => {
      const error = new MorselError(path, code, new Error('fail'));

      expect(error[property]).toBe(expected);
    });
  });

  it('preserves cause as NodeJS.ErrnoException when it has a string code', () => {
    const cause = Object.assign(new Error('fail'), { code: 'ENOENT' });
    const error = new MorselError('/path/config.json', 'EIO', cause);

    expect(error.cause).toBe(cause);
    expect(error.cause).toBeInstanceOf(Error);
  });

  describe('message formatting', () => {
    it.each<{
      name: string;
      path: string | undefined;
      code: MorselErrorCode;
      causeMessage: string;
      expected: string;
    }>([
      {
        name: 'formats message with code and cause message and path',
        path: '/path/config.json',
        code: 'EIO',
        causeMessage: 'ENOENT: not found',
        expected: 'morsel: EIO — ENOENT: not found (/path/config.json)',
      },
      {
        name: 'formats message without path when path is undefined',
        path: undefined,
        code: 'EVALIDATE',
        causeMessage: 'bad config',
        expected: 'morsel: EVALIDATE — bad config',
      },
      {
        name: 'formats message with cause message and path',
        path: '/path/config.json',
        code: 'ECYCLE',
        causeMessage: 'cycle detected',
        expected: 'morsel: ECYCLE — cycle detected (/path/config.json)',
      },
    ])('$name', ({ path, code, causeMessage, expected }) => {
      const error = new MorselError(path, code, new Error(causeMessage));

      expect(error.message).toBe(expected);
    });
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
