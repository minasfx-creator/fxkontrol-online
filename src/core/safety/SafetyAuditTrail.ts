/**
 * ─── Safety Audit Trail ────────────────────────────────────────────
 * Append-only log of all safety events, persisted to IndexedDB.
 * Uses centralized dbConnection for unified store management.
 */

import { getDB } from '@/core/persistence/dbConnection';

const STORE_AUDIT = 'safety_audit';

export interface AuditEntry {
  timestamp: number;
  tick: number;
  event: 'ARM' | 'DISARM' | 'FIRE' | 'E_STOP' | 'VIOLATION' | 'STATE_CHANGE' | 'LOCK' | 'UNLOCK' | 'RESET' | 'CONTINUITY_CHECK';
  from: string;
  to: string;
  detail: string;
  originSiteId?: string;
}

class SafetyAuditTrail {
  private _entries: AuditEntry[] = [];

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
      const db = await getDB();
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
      const db = await getDB();
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
      const db = await getDB();
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      tx.objectStore(STORE_AUDIT).clear();
    } catch (e) {
      console.warn('[SafetyAuditTrail] clear failed:', e);
    }
  }
}

export const safetyAuditTrail = new SafetyAuditTrail();
