/**
 * ─── Centralized IndexedDB Connection ──────────────────────────────
 * Single source of truth for the `fxkontrol_blackbox` database.
 * All stores are created here to prevent version conflicts.
 */

const DB_NAME = 'fxkontrol_blackbox';
const DB_VERSION = 4;

const ALL_STORES: { name: string; options: IDBObjectStoreParameters }[] = [
  { name: 'sessions', options: { keyPath: 'key' } },
  { name: 'snapshots', options: { keyPath: 'tick' } },
  { name: 'commandlog', options: { autoIncrement: true } },
  { name: 'safety_audit', options: { autoIncrement: true } },
];

let _dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, store.options);
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _dbPromise = null;
      console.warn('[dbConnection] Failed to open DB:', req.error);
      reject(req.error);
    };
  });

  return _dbPromise;
}
