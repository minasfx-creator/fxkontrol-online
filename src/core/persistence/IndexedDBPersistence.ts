/**
 * ─── IndexedDB Persistence ─────────────────────────────────────────
 * Persists SnapshotManager ring buffer and CommandLog entries to
 * IndexedDB for session survival across page reloads.
 * Uses centralized dbConnection for unified store management.
 */

import type { Snapshot } from '@/core/state/SnapshotManager';
import type { LogEntry } from '@/core/command/CommandLog';
import { getDB } from '@/core/persistence/dbConnection';

const STORE_SNAPSHOTS = 'snapshots';
const STORE_COMMANDLOG = 'commandlog';

class IndexedDBPersistence {
  /** Persist full snapshot array (replaces all). */
  async persistSnapshots(snapshots: readonly Snapshot[]): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.clear();
      for (const snap of snapshots) {
        store.put(snap);
      }
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn('[IndexedDBPersistence] persistSnapshots failed:', e);
    }
  }

  /** Persist command log entries (replaces all). */
  async persistCommandLog(entries: readonly LogEntry[]): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_COMMANDLOG, 'readwrite');
      const store = tx.objectStore(STORE_COMMANDLOG);
      store.clear();
      for (const entry of entries) {
        store.put(entry);
      }
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn('[IndexedDBPersistence] persistCommandLog failed:', e);
    }
  }

  /** Load all snapshots from IDB. */
  async loadSnapshots(): Promise<Snapshot[]> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[IndexedDBPersistence] loadSnapshots failed:', e);
      return [];
    }
  }

  /** Load all command log entries from IDB. */
  async loadCommandLog(): Promise<LogEntry[]> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_COMMANDLOG, 'readonly');
      const store = tx.objectStore(STORE_COMMANDLOG);
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[IndexedDBPersistence] loadCommandLog failed:', e);
      return [];
    }
  }

  /** Clear all persisted data. */
  async clearAll(): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_SNAPSHOTS, STORE_COMMANDLOG], 'readwrite');
      tx.objectStore(STORE_SNAPSHOTS).clear();
      tx.objectStore(STORE_COMMANDLOG).clear();
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn('[IndexedDBPersistence] clearAll failed:', e);
    }
  }
}

export const indexedDBPersistence = new IndexedDBPersistence();
