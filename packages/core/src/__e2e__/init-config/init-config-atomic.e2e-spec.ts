import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

import { initConfig } from '@/index';

describe('init-config-atomic — atomic write', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('writes atomically without leaving .tmp file behind', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(existsSync(result)).toBe(true);

    const files = readdirSync(projectDirectory);
    const temporaryFiles = files.filter((file) => file.includes('.tmp.'));
    expect(temporaryFiles).toHaveLength(0);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });

  it('atomic write format: .tmp.<timestamp> then renameSync', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(existsSync(result)).toBe(true);

    const expectedPath = path.resolve(projectDirectory, 'myapp.config.json');
    expect(result).toBe(expectedPath);

    const files = readdirSync(projectDirectory);
    expect(files).toContain('myapp.config.json');
    expect(files).not.toContain('myapp.config.json.tmp');

    const temporaryPattern = /^myapp\.config\.json\.tmp\.\d+$/;
    const residualTemporary = files.filter((file) =>
      temporaryPattern.test(file),
    );
    expect(residualTemporary).toHaveLength(0);
  });
});
