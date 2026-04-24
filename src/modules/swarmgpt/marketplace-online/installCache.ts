/**
 * IndexedDB-backed install cache.
 *
 * Stores verified artifact bytes keyed by sha256, so re-installing the same
 * version is instant and offline-safe. Falls back to a no-op cache when
 * IndexedDB is unavailable (SSR, sandboxed iframes).
 */
const DB_NAME = "fxk-marketplace-cache-v1";
const STORE = "artifacts";

type CacheRecord = {
  sha256: string;
  bytes: Uint8Array;
  cachedAt: number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "sha256" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function getCached(sha256: string): Promise<Uint8Array | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(sha256);
    req.onsuccess = () => {
      const rec = req.result as CacheRecord | undefined;
      resolve(rec?.bytes ?? null);
    };
    req.onerror = () => resolve(null);
  });
}

export async function putCached(sha256: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ sha256, bytes, cachedAt: Date.now() } satisfies CacheRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function clearCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
