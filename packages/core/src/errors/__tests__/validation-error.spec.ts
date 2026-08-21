import { MorselError } from '@/errors/morsel-error';
import { MorselValidationError } from '@/errors/validation-error';

describe('MorselValidationError', () => {
  it('extends MorselError with EVALIDATE code', () => {
    const error = new MorselValidationError({
      'tools.eslint': 'expected boolean',
    });

    expect(error).toBeInstanceOf(MorselError);
    expect(error.code).toBe('EVALIDATE');
    expect(error.path).toBeUndefined();
    expect(error.name).toBe('MorselValidationError');
  });

  it('stores issues map', () => {
    const issues = { 'tools.eslint': 'expected boolean, received string' };
    const error = new MorselValidationError(issues);

    expect(error.issues).toEqual(issues);
  });

  it.each([
    [{ a: 'bad' }, '1 issue'],
    [{ a: 'bad', b: 'bad' }, '2 issues'],
  ])('formats message with %s', (issues, expected) => {
    const error = new MorselValidationError(issues);

    expect(error.message).toBe(
      `morsel: EVALIDATE — validation failed (${expected})`,
    );
  });
});
