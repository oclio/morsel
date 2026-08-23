import type { MorselLayer } from '@/store/types';
import { resolveKeyOrigin } from '@/writer/resolve-origin';

describe('resolveKeyOrigin', () => {
  const projectLayer: MorselLayer = {
    source: 'project',
    path: '/app/morsel.config.json',
    config: { server: { port: 3000 } },
    exists: true,
    extendsPaths: [],
  };

  const globalLayer: MorselLayer = {
    source: 'global',
    path: '/home/user/.config/morsel/morsel.config.json',
    config: { database: { host: 'localhost' } },
    exists: true,
    extendsPaths: [],
  };

  const layers: MorselLayer[] = [globalLayer, projectLayer];

  it('resolves key existing in project layer', () => {
    const origin = resolveKeyOrigin('server.port', layers);
    expect(origin.filePath).toBe('/app/morsel.config.json');
    expect(origin.exists).toBe(true);
    expect(origin.isWritable).toBe(true);
  });

  it('resolves key existing in global layer', () => {
    const origin = resolveKeyOrigin('database.host', layers);
    expect(origin.filePath).toBe(
      '/home/user/.config/morsel/morsel.config.json',
    );
    expect(origin.exists).toBe(true);
    expect(origin.isWritable).toBe(true);
  });

  it('falls back to project layer for new keys', () => {
    const origin = resolveKeyOrigin('new.key', layers);
    expect(origin.filePath).toBe('/app/morsel.config.json');
    expect(origin.exists).toBe(false);
    expect(origin.isWritable).toBe(true);
  });

  describe('explicit target', () => {
    it.each<{
      name: string;
      key: string;
      target: 'global' | 'project';
      testLayers: MorselLayer[];
      expectedFilePath: string | undefined;
      expectedExists: boolean;
    }>([
      {
        name: 'honors explicit global target',
        key: 'server.port',
        target: 'global',
        testLayers: layers,
        expectedFilePath: '/home/user/.config/morsel/morsel.config.json',
        expectedExists: false,
      },
      {
        name: 'honors explicit project target',
        key: 'database.host',
        target: 'project',
        testLayers: layers,
        expectedFilePath: '/app/morsel.config.json',
        expectedExists: false,
      },
      {
        name: 'honors explicit global target with key existing in global layer',
        key: 'database.host',
        target: 'global',
        testLayers: layers,
        expectedFilePath: '/home/user/.config/morsel/morsel.config.json',
        expectedExists: true,
      },
      {
        name: 'honors explicit project target with key existing in project layer',
        key: 'server.port',
        target: 'project',
        testLayers: layers,
        expectedFilePath: '/app/morsel.config.json',
        expectedExists: true,
      },
      {
        name: 'returns undefined filePath for explicit global target without global layer',
        key: 'server.port',
        target: 'global',
        testLayers: [projectLayer],
        expectedFilePath: undefined,
        expectedExists: false,
      },
      {
        name: 'returns undefined filePath for explicit project target without project layer',
        key: 'database.host',
        target: 'project',
        testLayers: [globalLayer],
        expectedFilePath: undefined,
        expectedExists: false,
      },
    ])(
      '$name',
      ({ key, target, testLayers, expectedFilePath, expectedExists }) => {
        const origin = resolveKeyOrigin(key, testLayers, target);
        expect(origin.filePath).toBe(expectedFilePath);
        expect(origin.exists).toBe(expectedExists);
        expect(origin.isWritable).toBe(true);
      },
    );
  });

  it('resolves from global layer when project layer is absent', () => {
    const origin = resolveKeyOrigin('database.host', [globalLayer]);
    expect(origin.filePath).toBe(
      '/home/user/.config/morsel/morsel.config.json',
    );
    expect(origin.exists).toBe(true);
    expect(origin.isWritable).toBe(true);
  });

  it('falls back to undefined filePath when no layers contain the key', () => {
    const origin = resolveKeyOrigin('missing.key', [globalLayer]);
    expect(origin.filePath).toBeUndefined();
    expect(origin.exists).toBe(false);
    expect(origin.isWritable).toBe(true);
  });

  it('falls back to project layer filePath when project exists without key and global is absent', () => {
    const origin = resolveKeyOrigin('missing.key', [projectLayer]);
    expect(origin.filePath).toBe('/app/morsel.config.json');
    expect(origin.exists).toBe(false);
    expect(origin.isWritable).toBe(true);
  });

  it('returns undefined filePath for empty layers', () => {
    const origin = resolveKeyOrigin('any.key', [], 'global');
    expect(origin.filePath).toBeUndefined();
    expect(origin.exists).toBe(false);
  });
});
