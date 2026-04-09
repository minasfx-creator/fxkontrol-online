/**
 * ─── Safety Audit Trail ────────────────────────────────────────────
 * Append-only log of all safety events, persisted to IndexedDB.
 * Used for post-incident analysis and regulatory compliance.
 */

const DB_NAME = 'fxkontrol_blackbox';
const DB_VERSION = 3; // bump to add audit store
const STORE_AUDIT = 'safety_audit';

export interface AuditEntry {
  timestamp: number;
  tick: number;
  event: 'ARM' | 'DISARM' | 'FIRE' | 'E_STOP' | 'VIOLATION' | 'STATE_CHANGE' | 'LOCK' | 'UNLOCK' | 'RESET';
  from: string;
  to: string;
  detail: string;
  originSiteId?: string;
}

class SafetyAuditTrail {
  private _entries: AuditEntry[] = [];
  private _db: IDBDatabase | null = null;
  private _ready: Promise<IDBDatabase>;

  constructor() {
    this._ready = this._open();
  }

  private _open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          db.createObjectStore(STORE_AUDIT, { autoIncrement: true });
        }
        // Ensure existing stores survive version bump
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'tick' });
        }
        if (!db.objectStoreNames.contains('commandlog')) {
          db.createObjectStore('commandlog', { autoIncrement: true });
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(req.result); };
      req.onerror = () => {
        console.warn('[SafetyAuditTrail] Failed to open DB:', req.error);
        reject(req.error);
      };
    });
  }

  /** Append an audit entry. */
  log(entry: AuditEntry): void {
    this._entries.push(entry);
  }

  /** Get all entries (read-only). */
  getAll(): readonly AuditEntry[] {
    return this._entries;
  }

  /** Export as JSON string. */
  exportJSON(): string {
    return JSON.stringify(this._entries);
  }

  /** Persist all entries to IndexedDB. */
  async persist(): Promise<void> {
    try {
      const db = await this._ready;
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      const store = tx.objectStore(STORE_AUDIT);
      store.clear();
      for (const entry of this._entries) {
        store.put(entry);
      }
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn('[SafetyAuditTrail] persist failed:', e);
    }
  }

  /** Load entries from IndexedDB. */
  async load(): Promise<void> {
    try {
      const db = await this._ready;
      const tx = db.transaction(STORE_AUDIT, 'readonly');
      const store = tx.objectStore(STORE_AUDIT);
      const entries = await new Promise<AuditEntry[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      });
      if (entries.length > 0) {
        this._entries = entries;
        console.log(`[SafetyAuditTrail] Restored ${entries.length} entries from IndexedDB`);
      }
    } catch (e) {
      console.warn('[SafetyAuditTrail] load failed:', e);
    }
  }

  /** Clear all entries (memory + IDB). */
  async clear(): Promise<void> {
    this._entries = [];
    try {
      const db = await this._ready;
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      tx.objectStore(STORE_AUDIT).clear();
    } catch (e) {
      console.warn('[SafetyAuditTrail] clear failed:', e);
    }
  }
}

export const safetyAuditTrail = new SafetyAuditTrail();
