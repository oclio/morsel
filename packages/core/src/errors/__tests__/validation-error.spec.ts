import { MorselError } from '@/errors/morsel-error';
import { ValidationError } from '@/errors/validation-error';

describe('ValidationError', () => {
  it('extends MorselError with EVALIDATE code', () => {
    const error = new ValidationError({
      'tools.eslint': 'expected boolean',
    });

    expect(error).toBeInstanceOf(MorselError);
    expect(error.code).toBe('EVALIDATE');
    expect(error.path).toBeUndefined();
    expect(error.name).toBe('ValidationError');
  });

  it('stores issues map', () => {
    const issues = { 'tools.eslint': 'expected boolean, received string' };
    const error = new ValidationError(issues);

    expect(error.issues).toEqual(issues);
  });

  it.each([
    [{ a: 'bad' }, '1 issue'],
    [{ a: 'bad', b: 'bad' }, '2 issues'],
  ])('formats message with %s', (issues, expected) => {
    const error = new ValidationError(issues);

    expect(error.message).toBe(
      `morsel: EVALIDATE — validation failed (${expected})`,
    );
  });
});
