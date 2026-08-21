import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('edge-concurrent-stores-different-dirs — independent watchers', () => {
  clearWatcherRegistry();

  it('2 stores on 2 directories → independent, no interference', async () => {
    const { directory } = await createTemporaryEnvironment();
    const directoryA = `${directory}/a/project`;
    const directoryB = `${directory}/b/project`;
    const globalA = `${directory}/a/global`;
    const globalB = `${directory}/b/global`;

    await mkdir(directoryA, { recursive: true });
    await mkdir(directoryB, { recursive: true });
    await mkdir(globalA, { recursive: true });
    await mkdir(globalB, { recursive: true });
    await writeConfig(directoryA, 'myapp.config.json', { port: 3000 });
    await writeConfig(directoryB, 'myapp.config.json', { port: 8080 });

    const storeA = await watchConfig({
      name: 'myapp',
      cwd: directoryA,
      globalDir: globalA,
    });
    const storeB = await watchConfig({
      name: 'myapp',
      cwd: directoryB,
      globalDir: globalB,
    });

    expect(storeA.config).toEqual({ port: 3000 });
    expect(storeB.config).toEqual({ port: 8080 });

    const storeBChanged = new Promise<void>((resolve) => {
      storeB.on('port', () => resolve());
    });

    await writeConfig(directoryA, 'myapp.config.json', { port: 9999 });

    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(storeA.config).toEqual({ port: 9999 });
    expect(storeB.config).toEqual({ port: 8080 });

    const storeBChangePromise = storeBChanged;
    await Promise.race([
      storeBChangePromise,
      new Promise<void>((resolve) => setTimeout(() => resolve(), 100)),
    ]);

    expect(storeB.config).toEqual({ port: 8080 });

    await storeA.stop();
    await storeB.stop();
  });
});
