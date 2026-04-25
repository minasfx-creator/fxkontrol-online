/**
 * timelineViewState — Persist UI-only timeline state across reloads.
 *
 * Scope: presentation layer (collapsed flag, zoom, horizontal scroll).
 * NOT canonical show data — never persist anything from ShowPlan here.
 *
 * Storage: localStorage. Keys are namespaced under `fxk-timeline-view:*`.
 * Writes are debounced/throttled by callers to avoid hot-path churn.
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

function safeParse(raw: string | null): TimelineViewState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadTimelineView(): TimelineViewState {
  if (typeof window === 'undefined') return {};
  try {
    return safeParse(window.localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export function saveTimelineView(patch: Partial<TimelineViewState>): void {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...loadTimelineView(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
}
