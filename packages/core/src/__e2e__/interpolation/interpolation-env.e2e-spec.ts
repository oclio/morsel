import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

import { interpolate } from '@/index';

describe('interpolation-env — ${VAR} from process.env', () => {
  const savedVariables = new Map<string, string | undefined>();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  afterEach(() => {
    for (const [name, originalValue] of savedVariables) {
      if (originalValue === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = originalValue;
      }
    }
    savedVariables.clear();
  });

  const setEnvironment = (name: string, value: string) => {
    if (!savedVariables.has(name)) {
      savedVariables.set(name, process.env[name]);
    }
    process.env[name] = value;
  };

  it('${VAR} interpolation from process.env', async () => {
    setEnvironment('MORSEL_PORT', '8080');

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: '${MORSEL_PORT}' },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ port: '8080' });
  });

  it('${VAR} not found → left as-is', async () => {
    if (!savedVariables.has('MORSEL_MISSING')) {
      savedVariables.set('MORSEL_MISSING', process.env['MORSEL_MISSING']);
    }
    Reflect.deleteProperty(process.env, 'MORSEL_MISSING');

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: '${MORSEL_MISSING}' },
      createGlobalDir: true,
    });

    expect(result!.config).toEqual({ port: '${MORSEL_MISSING}' });
  });

  it('${VAR} with whitespace: ${ VAR } → trimmed', async () => {
    setEnvironment('MORSEL_HOST', 'localhost');
    const result = interpolate({ host: '${ MORSEL_HOST }' });

    expect(result).toEqual({ host: 'localhost' });
  });

  it('${VAR} in nested objects', async () => {
    setEnvironment('MORSEL_DB', 'postgres');
    const result = interpolate({
      database: { url: '${MORSEL_DB}' },
    });

    expect(result).toEqual({ database: { url: 'postgres' } });
  });

  it('${VAR} in arrays', async () => {
    setEnvironment('MORSEL_A', 'alpha');
    setEnvironment('MORSEL_B', 'beta');
    const result = interpolate({
      items: ['${MORSEL_A}', '${MORSEL_B}'],
    });

    expect(result).toEqual({ items: ['alpha', 'beta'] });
  });

  it('multiple ${VAR} in same string', async () => {
    setEnvironment('MORSEL_A', 'alpha');
    setEnvironment('MORSEL_B', 'beta');
    const result = interpolate({
      label: '${MORSEL_A}-${MORSEL_B}',
    });

    expect(result).toEqual({ label: 'alpha-beta' });
  });

  it('${VAR} with custom env record', () => {
    const result = interpolate(
      { db: '${DB_URL}' },
      { DB_URL: 'postgres://localhost' },
    );

    expect(result).toEqual({ db: 'postgres://localhost' });
  });
});
