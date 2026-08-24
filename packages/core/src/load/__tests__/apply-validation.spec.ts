import { ValidationError } from '@/errors/validation-error';
import { applyValidation } from '@/load/apply-validation';
import type { ValidationPlugin } from '@/plugins/types';

function makePlugin(
  name: string,
  validate: (config: Record<string, unknown>) => Record<string, unknown>,
): ValidationPlugin {
  return { name, validate };
}

describe('applyValidation', () => {
  it('returns config unchanged when no plugins', () => {
    const config = { foo: 'bar' };
    expect(applyValidation(config, [])).toBe(config);
  });

  it('passes config through a single plugin', () => {
    const plugin = makePlugin('p', (c) => ({ ...c, validated: true }));
    expect(applyValidation({ foo: 'bar' }, [plugin])).toEqual({
      foo: 'bar',
      validated: true,
    });
  });

  it('chains plugins in order', () => {
    const p1 = makePlugin('p1', (c) => ({ ...c, step: 1 }));
    const p2 = makePlugin('p2', (c) => ({
      ...c,
      step: (c['step'] as number) + 1,
    }));
    expect(applyValidation({}, [p1, p2])).toEqual({ step: 2 });
  });

  it.each([
    ['Error', new Error('bad config'), 'bad config'],
    ['non-Error', 'string error', 'string error'],
  ])('wraps a thrown %s into ValidationError', (_label, thrown, expected) => {
    const plugin = makePlugin('p', () => {
      throw thrown;
    });
    try {
      applyValidation({}, [plugin]);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toEqual({
        p: expected,
      });
    }
  });

  it('rethrows ValidationError as-is', () => {
    const original = new ValidationError({ field: 'invalid' });
    const plugin = makePlugin('p', () => {
      throw original;
    });
    try {
      applyValidation({}, [plugin]);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBe(original);
    }
  });

  it('feeds plugin output to the next plugin', () => {
    const p1 = makePlugin('p1', () => ({ a: 1 }));
    const p2 = makePlugin('p2', (c) => ({ ...c, b: 2 }));
    expect(applyValidation({}, [p1, p2])).toEqual({ a: 1, b: 2 });
  });
});
