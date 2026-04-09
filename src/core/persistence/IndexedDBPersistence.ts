/**
 * ─── IndexedDB Persistence ─────────────────────────────────────────
 * Persists SnapshotManager ring buffer and CommandLog entries to
 * IndexedDB for session survival across page reloads.
 * Reuses `fxkontrol_blackbox` DB with versioned object stores.
 */

import type { Snapshot } from '@/core/state/SnapshotManager';
import type { LogEntry } from '@/core/command/CommandLog';

const DB_NAME = 'fxkontrol_blackbox';
const DB_VERSION = 3; // v3: safety_audit store added by SafetyAuditTrail
const STORE_SNAPSHOTS = 'snapshots';
const STORE_COMMANDLOG = 'commandlog';

class IndexedDBPersistence {
  private _db: IDBDatabase | null = null;
  private _ready: Promise<IDBDatabase>;

  constructor() {
    this._ready = this._open();
  }

  private _open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = req.result;
        // Ensure stores exist
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'tick' });
        }
        if (!db.objectStoreNames.contains(STORE_COMMANDLOG)) {
          db.createObjectStore(STORE_COMMANDLOG, { autoIncrement: true });
        }
      };

      req.onsuccess = () => {
        this._db = req.result;
        resolve(req.result);
      };

      req.onerror = () => {
        console.warn('[IndexedDBPersistence] Failed to open DB:', req.error);
        reject(req.error);
      };
    });
  }

  /** Persist full snapshot array (replaces all). */
  async persistSnapshots(snapshots: readonly Snapshot[]): Promise<void> {
    try {
      const db = await this._ready;
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
      const db = await this._ready;
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
      const db = await this._ready;
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
      const db = await this._ready;
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
      const db = await this._ready;
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
