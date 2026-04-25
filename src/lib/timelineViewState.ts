/**
 * timelineViewState — Persist UI-only timeline state across reloads.
 *
 * Scope: presentation layer (collapsed flag, zoom, horizontal scroll).
 * NOT canonical show data — never persist anything from ShowPlan here.
 *
 * Versioning contract:
 *   • Every persisted blob carries a numeric `__v` schema version.
 *   • On read, blobs older than CURRENT_VERSION are run through the
 *     `MIGRATIONS` pipeline (v_n → v_{n+1}) before sanitization. This means
 *     future shape changes (renamed fields, unit changes, new defaults) can
 *     be added by appending one migration step — playback / editor code
 *     keeps reading the latest shape and never has to special-case old data.
 *   • Unknown / future versions (blob written by a newer build, then user
 *     downgrades) are discarded safely → fall back to defaults rather than
 *     mis-interpreting fields.
 *   • Writes always stamp the current version, so the store self-heals on
 *     the next save.
 *
 * Resilience contract:
 *   • Every read goes through per-field validation. Anything that isn't the
 *     expected primitive (wrong type, NaN, ±Infinity, negative scroll) is
 *     dropped and the field falls back to undefined — callers then use their
 *     own safe defaults.
 *   • Storage access is wrapped in try/catch so SSR, disabled cookies,
 *     Safari private mode (QuotaExceededError on first write), or a
 *     `localStorage` getter that throws SecurityError never crash the app.
 *   • One corrupt JSON blob auto-clears itself so it can't poison subsequent
 *     reads/writes (e.g. a half-written value from a previous tab crash).
 */
const KEY = 'fxk-timeline-view';

/**
 * Current schema version. Bump this whenever the persisted shape changes
 * and add a migration step in MIGRATIONS that brings the previous version
 * up to the new one.
 *
 * History:
 *   v0 — implicit (legacy blobs with no `__v` field). { collapsed?, pixelsPerSecond?, scrollLeft? }
 *   v1 — explicit version stamp added. Same field shape as v0.
 */
export const CURRENT_VERSION = 1;

export interface TimelineViewState {
  /** Bottom panel collapsed flag (Index.tsx). */
  collapsed?: boolean;
  /** Zoom (pixels per second) — clamped by Timeline at read time. */
  pixelsPerSecond?: number;
  /** Horizontal scroll position of the timeline scroll container. */
  scrollLeft?: number;
}

/**
 * Ordered migration steps. `MIGRATIONS[n]` upgrades a v_n blob to a v_{n+1}
 * blob. Always append — never reorder or delete past entries, or users on old
 * builds will silently lose their state on the next reload.
 */
const MIGRATIONS: Array<(input: Record<string, unknown>) => Record<string, unknown>> = [
  // v0 → v1: shape unchanged, just stamp the version.
  (input) => ({ ...input, __v: 1 }),
];

/** True iff localStorage is reachable AND writable. Memoised after first probe. */
let storageProbe: boolean | null = null;
function hasStorage(): boolean {
  if (storageProbe !== null) return storageProbe;
  if (typeof window === 'undefined') return (storageProbe = false);
  try {
    const probeKey = `${KEY}__probe`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    storageProbe = true;
  } catch {
    storageProbe = false;
  }
  return storageProbe;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Detect the schema version of a parsed blob.
 *  • Numeric `__v` wins.
 *  • Legacy blobs (no `__v`) are treated as v0.
 *  • Anything else (string, NaN, negative) → null = "discard".
 */
function detectVersion(raw: Record<string, unknown>): number | null {
  if (!('__v' in raw)) return 0;
  const v = raw.__v;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return null;
}

/**
 * Run the parsed blob through MIGRATIONS until it reaches CURRENT_VERSION.
 * Returns null if the blob is from a newer (unknown) version — we'd rather
 * drop it than risk mis-interpreting fields whose meaning changed.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  const version = detectVersion(raw);
  if (version === null) return null;
  if (version > CURRENT_VERSION) return null; // downgrade scenario — bail safely
  let current = raw;
  for (let v = version; v < CURRENT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null; // gap in pipeline — treat as corrupt
    try {
      current = step(current);
    } catch {
      return null;
    }
  }
  return current;
}

function sanitize(raw: unknown): TimelineViewState {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: TimelineViewState = {};
  if (typeof r.collapsed === 'boolean') out.collapsed = r.collapsed;
  if (isFiniteNumber(r.pixelsPerSecond) && r.pixelsPerSecond > 0) {
    out.pixelsPerSecond = r.pixelsPerSecond;
  }
  if (isFiniteNumber(r.scrollLeft) && r.scrollLeft >= 0) {
    out.scrollLeft = r.scrollLeft;
  }
  return out;
}

function clearCorrupt(): void {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}

export function loadTimelineView(): TimelineViewState {
  if (!hasStorage()) return {};
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Stored blob is unparseable — wipe so it can't keep failing every reload.
    clearCorrupt();
    return {};
  }
  if (!parsed || typeof parsed !== 'object') {
    clearCorrupt();
    return {};
  }
  const migrated = migrate(parsed as Record<string, unknown>);
  if (!migrated) {
    // Unknown/future version or broken migration — drop it and start fresh.
    clearCorrupt();
    return {};
  }
  return sanitize(migrated);
}

export function saveTimelineView(patch: Partial<TimelineViewState>): void {
  if (!hasStorage()) return;
  try {
    const next = sanitize({ ...loadTimelineView(), ...patch });
    // Always stamp current version on write — self-heals older blobs.
    const stamped = { ...next, __v: CURRENT_VERSION };
    window.localStorage.setItem(KEY, JSON.stringify(stamped));
  } catch {
    // Quota exceeded / locked storage — drop the write silently. Next reload
    // just falls back to defaults; nothing in the editor depends on this.
  }
}

/**
 * Wipe the persisted timeline view (zoom, scroll, collapsed). Safe to call
 * even if storage is unavailable. Returns true if a delete was attempted.
 * Caller is responsible for reloading / resetting in-memory state.
 */
export function resetTimelineView(): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/** Test-only: reset the cached storage probe (so unit tests can re-run hasStorage). */
export function __resetStorageProbe(): void {
  storageProbe = null;
}
