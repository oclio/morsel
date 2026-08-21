import { defineConfig } from '@/index';

describe('helper-define-config — pass-through with type inference', () => {
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
});
