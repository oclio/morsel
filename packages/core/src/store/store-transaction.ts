import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { selectParser } from '@/plugins/select-parser';
import { emitChanges } from '@/store/reactive/emit-changes';
import type { StoreState } from '@/store/store-state';
import type { BackupEntry } from '@/store/transaction-backup';
import {
  backupDirtyFiles,
  cleanupBackups,
  restoreFromBak,
} from '@/store/transaction-backup';
import type { ConfigRecord, MorselLayer } from '@/store/types';
import { atomicWrite } from '@/writer/atomic-write';

/**
 * Snapshot of store state taken at the start of a transaction.
 * Used to rollback in-memory state if the callback throws or the commit fails.
 */
interface TransactionSnapshot<T extends ConfigRecord> {
  config: T;
  layers: MorselLayer[];
  lastConfig: ConfigRecord;
}

function takeSnapshot<T extends ConfigRecord>(
  state: StoreState<T>,
): TransactionSnapshot<T> {
  return {
    config: state._config,
    layers: state._layers,
    lastConfig: state.lastConfig,
  };
}

function restoreSnapshot<T extends ConfigRecord>(
  state: StoreState<T>,
  snapshot: TransactionSnapshot<T>,
): void {
  state._config = snapshot.config;
  state._layers = snapshot.layers;
  state.lastConfig = snapshot.lastConfig;
}

/**
 * Track a dirty key for a given layer path during a transaction.
 * Called by doMutateKey / doDeleteKey when state.inTransaction is true.
 */
export function trackDirtyKey(
  state: StoreState,
  layerPath: string,
  canonicalKey: string,
): void {
  let set = state.transactionDirtyKeys.get(layerPath);
  if (set === undefined) {
    set = new Set();
    state.transactionDirtyKeys.set(layerPath, set);
  }
  set.add(canonicalKey);
}

/**
 * Serialize a layer config and write it atomically (tmp + rename).
 * Does NOT re-read the file — the config is already in memory.
 */
async function writeLayer(
  filePath: string,
  config: ConfigRecord,
  formatPlugins: Parameters<typeof selectParser>[1],
): Promise<void> {
  const plugin = selectParser(filePath, formatPlugins);
  if (plugin === undefined) {
    throw new Error(`No format plugin found for file "${filePath}"`);
  }
  const serialized = plugin.serialize(config);
  await atomicWrite(filePath, serialized);
}

async function writeDirtyLayers<T extends ConfigRecord>(
  state: StoreState<T>,
  dirtyLayers: MorselLayer[],
): Promise<string[]> {
  const writtenFiles: string[] = [];
  for (const layer of dirtyLayers) {
    const filePath = layer.path as string;
    await writeLayer(
      filePath,
      layer.config as ConfigRecord,
      state.options.formatPlugins,
    );
    writtenFiles.push(filePath);
  }
  return writtenFiles;
}

async function runWriteHooksForFiles<T extends ConfigRecord>(
  state: StoreState<T>,
  files: string[],
): Promise<void> {
  for (const file of files) {
    const writeEvent: WriteEvent = {
      filePath: file,
      keyPath: '*',
      mutation: { path: '*' },
    };
    await runWriteHooks(state.options.hooks, writeEvent, state.options.onDebug);
  }
}

/**
 * Execute a transaction: snapshot state, run callback with in-memory-only
 * mutations, then atomically commit all dirty layers to disk.
 *
 * On callback error: rollback in-memory state, no writes.
 * On commit error: restore .bak files, rollback in-memory state.
 *
 * Events are emitted explicitly after a successful commit, independent
 * of the watch subsystem (works in headless mode).
 */
export async function runTransaction<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
  callback: () => Promise<void>,
): Promise<void> {
  if (state.stopped) {
    throw new Error('morsel: store is stopped');
  }
  if (state.inTransaction) {
    throw new Error('morsel: nested transactions are not supported');
  }

  const snapshot = takeSnapshot(state);
  state.inTransaction = true;
  state.transactionDirtyKeys = new Map();

  let callbackError: unknown;
  try {
    await callback();
  } catch (error) {
    callbackError = error;
  }

  if (callbackError !== undefined) {
    restoreSnapshot(state, snapshot);
    state.transactionDirtyKeys = new Map();
    state.inTransaction = false;
    throw callbackError;
  }

  const dirtyLayers = state._layers.filter((layer) =>
    state.transactionDirtyKeys.has(layer.path as string),
  );

  let backups: BackupEntry[] = [];
  let writtenFiles: string[];

  try {
    backups = await backupDirtyFiles(dirtyLayers);
    writtenFiles = await writeDirtyLayers(state, dirtyLayers);
    await cleanupBackups(backups);
  } catch (commitError) {
    await restoreFromBak(backups);
    restoreSnapshot(state, snapshot);
    state.transactionDirtyKeys = new Map();
    state.inTransaction = false;
    throw commitError;
  }

  emitChanges(
    snapshot.lastConfig,
    state.lastConfig,
    state.listeners,
    state.wildcardListeners,
  );

  await runWriteHooksForFiles(state, writtenFiles);

  state.transactionDirtyKeys = new Map();
  state.inTransaction = false;
}
