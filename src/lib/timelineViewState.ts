/**
 * timelineViewState — Persist UI-only timeline state across reloads.
 *
 * Scope: presentation layer (collapsed flag, zoom, horizontal scroll).
 * NOT canonical show data — never persist anything from ShowPlan here.
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

export interface TimelineViewState {
  /** Bottom panel collapsed flag (Index.tsx). */
  collapsed?: boolean;
  /** Zoom (pixels per second) — clamped by Timeline at read time. */
  pixelsPerSecond?: number;
  /** Horizontal scroll position of the timeline scroll container. */
  scrollLeft?: number;
}

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
  return sanitize(parsed);
}

export function saveTimelineView(patch: Partial<TimelineViewState>): void {
  if (!hasStorage()) return;
  try {
    const next = sanitize({ ...loadTimelineView(), ...patch });
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded / locked storage — drop the write silently. Next reload
    // just falls back to defaults; nothing in the editor depends on this.
  }
}

/** Test-only: reset the cached storage probe (so unit tests can re-run hasStorage). */
export function __resetStorageProbe(): void {
  storageProbe = null;
}
