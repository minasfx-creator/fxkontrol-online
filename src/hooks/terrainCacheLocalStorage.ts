/**
 * terrainCacheLocalStorage — Browser-local persistence for resolved terrain
 * heights, complementing the cloud-backed `terrainCachePersistence`.
 *
 * Why both?
 *  - Cloud persistence survives across devices but requires a network round
 *    trip on hydrate (~hundreds of ms on cold start).
 *  - Local persistence is synchronous-ish (IndexedDB) and lets pins snap to
 *    the last-known terrain BEFORE the cloud hydrate resolves, eliminating
 *    the "flash to y=0" on reload.
 *
 * Design rules:
 *  - Keys mirror posKey() in useTerrainHeightCache (XZ * 10, integer).
 *  - Storage is keyed by `${projectId}:${tilesetKind}:${tilesetVersion}` so
 *    different versions don't collide (matches the cloud schema).
 *  - Writes are batched + debounced; we never block the render loop.
 *  - TTL + version expiration are honored on hydrate: stale entries are
 *    skipped AND the whole store entry is wiped if its version doesn't match.
 *  - IndexedDB primary, with a localStorage fallback for environments that
 *    block IDB (private mode / iframes / SSR).
 */
const DB_NAME = 'fxk_terrain_cache';
const STORE = 'heights';
const SCHEMA_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 800;
const MAX_ENTRIES_PER_SCOPE = 50_000; // Soft safety cap (~50k * 16B = 0.8MB)
const LS_PREFIX = 'fxk:terrain:';

/**
 * Persistence mode for the browser-local cache.
 *  - 'project': IndexedDB (long-lived, scoped per `${projectId}:kind:version`).
 *               Survives reloads + tab close. Default.
 *  - 'session': sessionStorage only. Survives reloads of the SAME tab; clears
 *               on tab close. Good when you want to test fresh terrain
 *               sampling each work session without re-using stale heights.
 *  - 'none':    in-memory only (no browser persistence). Hot-reload still
 *               benefits from cloud hydrate if enabled.
 */
export type LocalCacheMode = 'project' | 'session' | 'none';

export interface LocalCacheScope {
  projectId: string;
  tilesetKind: string;
  tilesetVersion: string;
  /** Max age in days; entries older than this are skipped on hydrate. 0 = no TTL. */
  maxAgeDays: number;
  /** Persistence mode (default 'project'). */
  mode?: LocalCacheMode;
}

interface StoredEntry {
  v: number; // schema version
  ver: string; // tilesetVersion (also part of key, kept for paranoid validation)
  ts: number; // last write epoch ms
  // Flat number array: [x_tenths, z_tenths, y, x_tenths, z_tenths, y, ...]
  // Stored flat for compactness; ~3x smaller JSON than {key:y} maps for big sets.
  data: number[];
}

export interface TerrainLocalCacheHandle {
  /** Load saved heights into the provided in-memory map. Returns hydrated count. */
  hydrate: (cache: Map<string, number>) => Promise<number>;
  /** Mark a key as needing local persist (debounced). */
  markDirty: (key: string, x_tenths: number, z_tenths: number, y: number) => void;
  /** Force-flush any pending writes (e.g. on unmount or beforeunload). */
  flush: () => Promise<void>;
  /** Drop the local copy for this scope (e.g. on tileset version bump). */
  clear: () => Promise<void>;
  /** Stop accepting writes. */
  dispose: () => void;
}

function scopeKey(s: LocalCacheScope): string {
  return `${s.projectId}|${s.tilesetKind}|${s.tilesetVersion}`;
}

// ── IndexedDB wrapper (Promise-ified, single store) ─────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<StoredEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as StoredEntry | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: StoredEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Web Storage helpers (parameterized over storage type) ──────────────────
// Used as: (a) localStorage fallback when IDB throws (mode='project'), and
// (b) the primary backend when mode='session' (uses sessionStorage).

function wsGet(storage: Storage | null, key: string): StoredEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredEntry) : null;
  } catch { return null; }
}
function wsPut(storage: Storage | null, key: string, v: StoredEntry): void {
  if (!storage) return;
  try { storage.setItem(LS_PREFIX + key, JSON.stringify(v)); }
  catch (e) { console.warn('[terrainCacheLocal] storage put failed:', e); }
}
function wsDelete(storage: Storage | null, key: string): void {
  if (!storage) return;
  try { storage.removeItem(LS_PREFIX + key); } catch { /* noop */ }
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'session' ? sessionStorage : localStorage;
  } catch { return null; }
}

// ── Public factory ──────────────────────────────────────────────────────────

export function createTerrainLocalCache(scope: LocalCacheScope): TerrainLocalCacheHandle {
  const mode: LocalCacheMode = scope.mode ?? 'project';
  const key = scopeKey(scope);
  // In-memory mirror of every key→y currently persisted (or queued). Lets the
  // debounced flush serialize the *full* set in one shot, which avoids
  // read-modify-write races.
  const mirror = new Map<string, number>();
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let useLs = false; // flips true once IDB has failed once (project mode only)
  let flushing = false;

  // Backend selector:
  //  - 'none'    : no I/O; mirror still works for in-memory mode but no flush.
  //  - 'session' : sessionStorage (per-tab, cleared on tab close).
  //  - 'project' : IndexedDB primary, localStorage fallback (long-lived).
  const sessionStore = mode === 'session' ? safeStorage('session') : null;
  const lsStore = mode === 'project' ? safeStorage('local') : null;

  async function readEntry(): Promise<StoredEntry | null> {
    if (mode === 'none') return null;
    if (mode === 'session') return wsGet(sessionStore, key);
    if (useLs) return wsGet(lsStore, key);
    try {
      return await idbGet(key);
    } catch (e) {
      console.warn('[terrainCacheLocal] IDB get failed, falling back to localStorage:', e);
      useLs = true;
      return wsGet(lsStore, key);
    }
  }

  async function writeEntry(entry: StoredEntry): Promise<void> {
    if (mode === 'none') return;
    if (mode === 'session') { wsPut(sessionStore, key, entry); return; }
    if (useLs) { wsPut(lsStore, key, entry); return; }
    try {
      await idbPut(key, entry);
    } catch (e) {
      console.warn('[terrainCacheLocal] IDB put failed, falling back to localStorage:', e);
      useLs = true;
      wsPut(lsStore, key, entry);
    }
  }

  async function deleteEntry(): Promise<void> {
    if (mode === 'none') return;
    if (mode === 'session') { wsDelete(sessionStore, key); return; }
    try { await idbDelete(key); } catch { /* fall through to LS cleanup */ }
    wsDelete(lsStore, key);
  }

  async function flushNow(): Promise<void> {
    if (disposed || !dirty || flushing) return;
    flushing = true;
    try {
      // Apply the soft cap: keep most recent entries by insertion order. Map
      // preserves insertion order, so dropping from the front is correct.
      while (mirror.size > MAX_ENTRIES_PER_SCOPE) {
        const firstKey = mirror.keys().next().value;
        if (firstKey === undefined) break;
        mirror.delete(firstKey);
      }
      const data: number[] = new Array(mirror.size * 3);
      let i = 0;
      for (const [k, y] of mirror) {
        const sep = k.indexOf(':');
        // Defensive: malformed keys are silently dropped.
        if (sep < 0) continue;
        data[i++] = Number(k.slice(0, sep)) | 0;
        data[i++] = Number(k.slice(sep + 1)) | 0;
        data[i++] = y;
      }
      // Trim if any malformed keys were skipped.
      if (i < data.length) data.length = i;
      const entry: StoredEntry = {
        v: SCHEMA_VERSION,
        ver: scope.tilesetVersion,
        ts: Date.now(),
        data,
      };
      await writeEntry(entry);
      dirty = false;
    } catch (e) {
      console.warn('[terrainCacheLocal] flush failed:', e);
    } finally {
      flushing = false;
      if (timer) { clearTimeout(timer); timer = null; }
    }
  }

  return {
    async hydrate(cache) {
      if (disposed) return 0;
      const entry = await readEntry();
      if (!entry) return 0;
      // Version + TTL gate. Mismatches wipe the entry (cheap).
      if (entry.v !== SCHEMA_VERSION || entry.ver !== scope.tilesetVersion) {
        await deleteEntry();
        return 0;
      }
      if (scope.maxAgeDays > 0) {
        const ageMs = Date.now() - entry.ts;
        if (ageMs > scope.maxAgeDays * 86400_000) {
          await deleteEntry();
          return 0;
        }
      }
      let n = 0;
      const arr = entry.data;
      for (let i = 0; i + 2 < arr.length; i += 3) {
        const xt = arr[i] | 0;
        const zt = arr[i + 1] | 0;
        const y = arr[i + 2];
        const k = `${xt}:${zt}`;
        // Mirror everything we've loaded so subsequent writes serialize the
        // *complete* superset, not just newly-marked entries.
        mirror.set(k, y);
        if (!cache.has(k)) {
          cache.set(k, y);
          n++;
        }
      }
      return n;
    },
    markDirty(k, _xt, _zt, y) {
      if (disposed) return;
      const prev = mirror.get(k);
      if (prev === y) return; // No-op if value unchanged.
      mirror.set(k, y);
      dirty = true;
      if (!timer) {
        timer = setTimeout(() => { void flushNow(); }, FLUSH_DEBOUNCE_MS);
      }
    },
    async flush() {
      await flushNow();
    },
    async clear() {
      mirror.clear();
      dirty = false;
      if (timer) { clearTimeout(timer); timer = null; }
      await deleteEntry();
    },
    dispose() {
      disposed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      // Best-effort final flush is fire-and-forget; caller may also await flush().
    },
  };
}
