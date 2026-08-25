import { defineConfig } from '@/index';

describe('helpers-define-config — pass-through with type inference', () => {
  it('returns the same options object unchanged', () => {
    const options = defineConfig({
      name: 'myapp',
      defaults: { port: 3000, host: 'localhost' },
    });

    expect(options).toEqual({
      name: 'myapp',
      defaults: { port: 3000, host: 'localhost' },
    });
    expect(options.name).toBe('myapp');
    expect(options.defaults).toEqual({ port: 3000, host: 'localhost' });
  });

  it('identity: returns same reference', () => {
    const input = { name: 'myapp', defaults: { port: 3000 } };
    const result = defineConfig(input);

    expect(result).toBe(input);
  });

  it('minimal config with name only', () => {
    const options = defineConfig({ name: 'myapp' });

    expect(options).toEqual({ name: 'myapp' });
    expect(options.name).toBe('myapp');
  });
});
