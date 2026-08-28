import { MorselError } from '@/errors/error';
import { NoPluginError } from '@/errors/no-plugin-error';

describe('NoPluginError', () => {
  it('extends MorselError with ENOPLUGIN code', () => {
    const error = new NoPluginError('/path/config.yaml', '.yaml');

    expect(error).toBeInstanceOf(MorselError);
    expect(error.name).toBe('NoPluginError');
    expect(error.code).toBe('ENOPLUGIN');
    expect(error.path).toBe('/path/config.yaml');
    expect(error.extension).toBe('.yaml');
  });

  it.each(['.yaml', '.xml'])(
    'includes generic hint for extension %s',
    (extension) => {
      const error = new NoPluginError(`/path/config${extension}`, extension);

      expect(error.message).toContain('Register a FormatPlugin');
    },
  );

  it('includes specific hint when file has no extension', () => {
    const error = new NoPluginError('/path/config', '');

    expect(error.message).toContain('file has no extension');
  });
});
