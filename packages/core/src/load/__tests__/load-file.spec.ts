import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { MorselError } from '@/errors/morsel-error';
import { MorselNoPluginError } from '@/errors/no-plugin-error';
import { loadFile, loadFileSync } from '@/load/load-file';
import { jsonPlugin } from '@/plugins/json-plugin';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('@/errors/morsel-error', () => ({
  MorselError: class MorselError extends Error {
    readonly path: string | undefined;
    readonly code: string;
    override readonly cause: NodeJS.ErrnoException | undefined;
    constructor(
      path: string | undefined,
      code: string,
      cause?: NodeJS.ErrnoException | Error,
    ) {
      super(`morsel: ${code}`);
      this.name = 'MorselError';
      this.path = path;
      this.code = code;
      this.cause = cause as NodeJS.ErrnoException | undefined;
    }
  },
}));

function enoentError(): NodeJS.ErrnoException {
  return Object.assign(new Error('ENOENT: no such file or directory'), {
    code: 'ENOENT',
  }) as NodeJS.ErrnoException;
}

function permissionError(): NodeJS.ErrnoException {
  return Object.assign(new Error('EACCES: permission denied'), {
    code: 'EACCES',
  }) as NodeJS.ErrnoException;
}

async function expectMorselError(
  promise: Promise<unknown>,
  filePath: string,
  morselCode: string,
  causeCode: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(MorselError);
    expect((error as MorselError).path).toBe(filePath);
    expect((error as MorselError).code).toBe(morselCode);
    const cause = (error as MorselError).cause as
      NodeJS.ErrnoException | undefined;
    expect(cause?.code).toBe(causeCode);
  }
}

function expectMorselErrorSync(
  function_: () => unknown,
  filePath: string,
  morselCode: string,
  causeCode: string,
): void {
  try {
    function_();
    throw new Error('expected function to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(MorselError);
    expect((error as MorselError).path).toBe(filePath);
    expect((error as MorselError).code).toBe(morselCode);
    const cause = (error as MorselError).cause as
      NodeJS.ErrnoException | undefined;
    expect(cause?.code).toBe(causeCode);
  }
}

describe('loadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'valid JSON object',
      content: '{"foo":"bar"}',
      expected: { exists: true, config: { foo: 'bar' } },
    },
    {
      name: 'empty JSON object',
      content: '{}',
      expected: { exists: true, config: {} },
    },
    {
      name: 'nested JSON object',
      content: '{"a":{"b":1}}',
      expected: { exists: true, config: { a: { b: 1 } } },
    },
  ])(
    'returns exists:true with parsed config for $name',
    async ({ content, expected }) => {
      vi.mocked(readFile).mockResolvedValue(content);

      const result = await loadFile('/fake/config.json', [jsonPlugin]);

      expect(result).toEqual(expected);
      expect(readFile).toHaveBeenCalledWith('/fake/config.json', 'utf8');
    },
  );

  it('returns exists:false when file not found (ENOENT)', async () => {
    vi.mocked(readFile).mockRejectedValue(enoentError());

    const result = await loadFile('/fake/missing.json', [jsonPlugin]);

    expect(result).toEqual({ exists: false, config: {} });
  });

  it('throws MorselError preserving original error code for non-ENOENT fs errors', async () => {
    vi.mocked(readFile).mockRejectedValue(permissionError());

    await expectMorselError(
      loadFile('/fake/forbidden.json', [jsonPlugin]),
      '/fake/forbidden.json',
      'EIO',
      'EACCES',
    );
  });

  it.each([
    {
      name: 'a string',
      filePath: '/fake/weird.json',
      rejection: 'string error',
    },
    { name: 'null', filePath: '/fake/null.json', rejection: null },
    {
      name: 'a plain Error without code',
      filePath: '/fake/plain.json',
      rejection: new Error('something went wrong'),
    },
    {
      name: 'an error with non-string code',
      filePath: '/fake/numeric.json',
      rejection: Object.assign(new Error('weird code'), { code: 42 }),
    },
  ])(
    'throws MorselError with UNKNOWN code when rejection is $name',
    async ({ filePath, rejection }) => {
      vi.mocked(readFile).mockRejectedValue(rejection);

      await expectMorselError(
        loadFile(filePath, [jsonPlugin]),
        filePath,
        'EIO',
        'UNKNOWN',
      );
    },
  );

  it.each([
    { name: 'invalid JSON', content: 'not json' },
    { name: 'JSON array root', content: '[1,2,3]' },
    { name: 'JSON null root', content: 'null' },
    { name: 'JSON primitive root', content: '42' },
  ])('throws MorselError with EPARSE code for $name', async ({ content }) => {
    vi.mocked(readFile).mockResolvedValue(content);

    await expectMorselError(
      loadFile('/fake/bad.json', [jsonPlugin]),
      '/fake/bad.json',
      'EPARSE',
      'EPARSE',
    );
  });

  it('throws MorselError with EPARSE code and descriptive message for non-object root', async () => {
    vi.mocked(readFile).mockResolvedValue('[1,2,3]');

    try {
      await loadFile('/fake/array.json', [jsonPlugin]);
      throw new Error('expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(MorselError);
      expect((error as MorselError).code).toBe('EPARSE');
      const cause = (error as MorselError).cause as NodeJS.ErrnoException;
      expect(cause.code).toBe('EPARSE');
      expect(cause.message).toBe('JSON root must be an object');
    }
  });

  it('throws MorselNoPluginError when no plugin matches the extension', async () => {
    vi.mocked(readFile).mockResolvedValue('{}');

    try {
      await loadFile('/fake/config.yaml', [jsonPlugin]);
      throw new Error('expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(MorselNoPluginError);
      expect((error as MorselNoPluginError).code).toBe('ENOPLUGIN');
      expect((error as MorselNoPluginError).path).toBe('/fake/config.yaml');
      expect((error as MorselNoPluginError).extension).toBe('.yaml');
    }
  });

  it('throws MorselNoPluginError when file has no extension', async () => {
    vi.mocked(readFile).mockResolvedValue('{}');

    try {
      await loadFile('/fake/config', [jsonPlugin]);
      throw new Error('expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(MorselNoPluginError);
      expect((error as MorselNoPluginError).extension).toBe('');
    }
  });
});

describe('loadFileSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'valid JSON object',
      content: '{"foo":"bar"}',
      expected: { exists: true, config: { foo: 'bar' } },
    },
    {
      name: 'empty JSON object',
      content: '{}',
      expected: { exists: true, config: {} },
    },
    {
      name: 'nested JSON object',
      content: '{"a":{"b":1}}',
      expected: { exists: true, config: { a: { b: 1 } } },
    },
  ])(
    'returns exists:true with parsed config for $name',
    ({ content, expected }) => {
      vi.mocked(readFileSync).mockReturnValue(content);

      const result = loadFileSync('/fake/config.json', [jsonPlugin]);

      expect(result).toEqual(expected);
      expect(readFileSync).toHaveBeenCalledWith('/fake/config.json', 'utf8');
    },
  );

  it('returns exists:false when file not found (ENOENT)', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw enoentError();
    });

    const result = loadFileSync('/fake/missing.json', [jsonPlugin]);

    expect(result).toEqual({ exists: false, config: {} });
  });

  it('throws MorselError preserving original error code for non-ENOENT fs errors', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw permissionError();
    });

    expectMorselErrorSync(
      () => loadFileSync('/fake/forbidden.json', [jsonPlugin]),
      '/fake/forbidden.json',
      'EIO',
      'EACCES',
    );
  });

  it.each([
    { name: 'a string', filePath: '/fake/weird.json', thrown: 'string error' },
    { name: 'null', filePath: '/fake/null.json', thrown: null },
    {
      name: 'a plain Error without code',
      filePath: '/fake/plain.json',
      thrown: new Error('something went wrong'),
    },
    {
      name: 'an error with non-string code',
      filePath: '/fake/numeric.json',
      thrown: Object.assign(new Error('weird code'), { code: 42 }),
    },
  ])(
    'throws MorselError with UNKNOWN code when thrown value is $name',
    ({ filePath, thrown }) => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw thrown;
      });

      expectMorselErrorSync(
        () => loadFileSync(filePath, [jsonPlugin]),
        filePath,
        'EIO',
        'UNKNOWN',
      );
    },
  );

  it.each([
    { name: 'invalid JSON', content: 'not json' },
    { name: 'JSON array root', content: '[1,2,3]' },
    { name: 'JSON null root', content: 'null' },
    { name: 'JSON primitive root', content: '42' },
  ])('throws MorselError with EPARSE code for $name', ({ content }) => {
    vi.mocked(readFileSync).mockReturnValue(content);

    expectMorselErrorSync(
      () => loadFileSync('/fake/bad.json', [jsonPlugin]),
      '/fake/bad.json',
      'EPARSE',
      'EPARSE',
    );
  });

  it('throws MorselError with EPARSE code and descriptive message for non-object root', () => {
    vi.mocked(readFileSync).mockReturnValue('[1,2,3]');

    try {
      loadFileSync('/fake/array.json', [jsonPlugin]);
      throw new Error('expected function to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MorselError);
      expect((error as MorselError).code).toBe('EPARSE');
      const cause = (error as MorselError).cause as NodeJS.ErrnoException;
      expect(cause.code).toBe('EPARSE');
      expect(cause.message).toBe('JSON root must be an object');
    }
  });

  it('throws MorselNoPluginError when no plugin matches the extension', () => {
    vi.mocked(readFileSync).mockReturnValue('{}');

    try {
      loadFileSync('/fake/config.yaml', [jsonPlugin]);
      throw new Error('expected function to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MorselNoPluginError);
      expect((error as MorselNoPluginError).code).toBe('ENOPLUGIN');
      expect((error as MorselNoPluginError).path).toBe('/fake/config.yaml');
      expect((error as MorselNoPluginError).extension).toBe('.yaml');
    }
  });
});
