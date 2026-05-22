/**
 * ─── Timeline Grid (snap unification) ──────────────────────────────────────
 *
 * Single source of truth for snap-to-grid math used across all timeline
 * surfaces (track rows, drop preview, drag, resize, keyboard nudge).
 *
 * Replaces the old `snapTimeToBeat()` helper that lived in `Timeline.tsx`
 * and was only beat-aware. The new grid resolves a unit (beat | frame |
 * second) from the operator's `snapMode`, falling back gracefully when
 * BPM is missing (auto → frame).
 *
 * Threshold is **always expressed in pixels** so that zooming in makes the
 * snap window narrower in seconds — exactly the behaviour expected for
 * fine-tuning.
 */
import { timecodeProvider } from '@/core/time/timecodeProvider';

export type SnapMode = 'auto' | 'beat' | 'frame' | 'off';
export type GridUnit = 'beat' | 'frame' | 'second' | 'none';

export interface ActiveGrid {
  /** Decided unit. `none` means snap is disabled. */
  unit: GridUnit;
  /** Interval between primary lines in seconds. */
  interval: number;
  /** Source labels for the UI chip ("BEAT 120 BPM", "FRAME 30 fps", ...). */
  label: string;
}

export interface GetActiveGridArgs {
  bpm: number | null;
  snapMode: SnapMode;
  /** Optional override; default reads from `timecodeProvider.getFPS()`. */
  fps?: number;
}

/** Decide which grid is active for the current snap mode + project state. */
export function getActiveGrid({ bpm, snapMode, fps }: GetActiveGridArgs): ActiveGrid {
  const safeFps = Number.isFinite(fps) && (fps as number) > 0
    ? (fps as number)
    : timecodeProvider.getFPS() || 60;
  const beatInterval = bpm && bpm > 0 ? 60 / bpm : 0;
  const frameInterval = 1 / safeFps;

  switch (snapMode) {
    case 'off':
      return { unit: 'none', interval: 0, label: 'OFF' };

    case 'beat':
      if (beatInterval > 0) {
        return { unit: 'beat', interval: beatInterval, label: `BEAT ${bpm} BPM` };
      }
      // No BPM → graceful fallback to frame so the operator still gets snap.
      return { unit: 'frame', interval: frameInterval, label: `FRAME ${Math.round(safeFps)} fps` };

    case 'frame':
      return { unit: 'frame', interval: frameInterval, label: `FRAME ${Math.round(safeFps)} fps` };

    case 'auto':
    default:
      if (beatInterval > 0) {
        return { unit: 'beat', interval: beatInterval, label: `AUTO → BEAT ${bpm}` };
      }
      return { unit: 'frame', interval: frameInterval, label: `AUTO → FRAME ${Math.round(safeFps)} fps` };
  }
}

/**
 * Snap a free time value to the nearest grid line if within `thresholdPx`.
 * Returns `time` unchanged when the grid is disabled or the candidate is
 * outside the magnetic window.
 */
export function snapTime(
  time: number,
  grid: ActiveGrid,
  pixelsPerSecond: number,
  thresholdPx = 8,
): number {
  if (grid.unit === 'none' || grid.interval <= 0) return time;
  const nearest = Math.round(time / grid.interval) * grid.interval;
  const thresholdSec = thresholdPx / Math.max(1, pixelsPerSecond);
  return Math.abs(time - nearest) < thresholdSec ? nearest : time;
}

/** Force-quantize to the nearest grid line (used by keyboard nudge / Shift). */
export function quantizeTime(time: number, grid: ActiveGrid): number {
  if (grid.unit === 'none' || grid.interval <= 0) return time;
  return Math.round(time / grid.interval) * grid.interval;
}

/** Step exactly one grid unit forward / backward. */
export function stepTime(time: number, grid: ActiveGrid, direction: 1 | -1): number {
  if (grid.unit === 'none' || grid.interval <= 0) return time;
  return Math.max(0, time + direction * grid.interval);
}

// ── Visual subdivisions for TimelineGrid renderer ──────────────────────────

export interface GridLine {
  /** Time in seconds. */
  t: number;
  /** Visual weight: `major` (measure / second), `unit` (beat / frame), `sub` (¼ beat / 6-frame mark). */
  weight: 'major' | 'unit' | 'sub';
}

export interface GetSubdivisionsArgs {
  grid: ActiveGrid;
  duration: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  viewportWidth: number;
}

/**
 * Decide which lines to draw for the current zoom level. Always virtualised
 * to the visible window + a small buffer.
 *
 * Density rules (designed to never exceed ~1 line per 6 px):
 *   - Beat grid: shows ¼-beat subdivisions when beat * pps >= 32; every 4
 *     beats becomes a measure (`major`).
 *   - Frame grid: shows individual frames when frame * pps >= 12; every 6th
 *     frame becomes a `sub`; every full second becomes `major`.
 *   - When both subdivisions and units would be too dense, falls back to
 *     once-per-second `major` lines.
 */
export function getSubdivisions(args: GetSubdivisionsArgs): GridLine[] {
  const { grid, duration, pixelsPerSecond, scrollLeft, viewportWidth } = args;
  if (grid.unit === 'none' || grid.interval <= 0) return [];

  const buffer = 200;
  const startTime = Math.max(0, (scrollLeft - buffer) / pixelsPerSecond);
  const endTime = Math.min(duration, (scrollLeft + viewportWidth + buffer) / pixelsPerSecond);
  const out: GridLine[] = [];

  if (grid.unit === 'beat') {
    const beat = grid.interval;
    const showQuarter = beat * pixelsPerSecond >= 32;
    const stride = showQuarter ? beat / 4 : beat;
    const firstIdx = Math.floor(startTime / stride);
    for (let i = firstIdx; i * stride < endTime; i++) {
      const t = i * stride;
      if (t < 0) continue;
      const beatIdx = Math.round(t / beat);
      const isOnBeat = Math.abs(t - beatIdx * beat) < 1e-6;
      const isMeasure = isOnBeat && beatIdx % 4 === 0;
      out.push({ t, weight: isMeasure ? 'major' : isOnBeat ? 'unit' : 'sub' });
    }
    return out;
  }

  if (grid.unit === 'frame') {
    const frame = grid.interval;
    const showFrames = frame * pixelsPerSecond >= 12;
    if (!showFrames) {
      // Too zoomed out for individual frames — fall back to per-second majors.
      const firstSec = Math.floor(startTime);
      for (let s = firstSec; s <= endTime; s++) {
        if (s < 0) continue;
        out.push({ t: s, weight: 'major' });
      }
      return out;
    }
    const firstIdx = Math.floor(startTime / frame);
    for (let i = firstIdx; i * frame < endTime; i++) {
      const t = i * frame;
      if (t < 0) continue;
      const onSecond = Math.abs(t - Math.round(t)) < frame / 4;
      const sub = i % 6 === 0;
      out.push({ t, weight: onSecond ? 'major' : sub ? 'sub' : 'unit' });
    }
    return out;
  }

  // unit === 'second' (currently unused but reserved)
  const firstSec = Math.floor(startTime);
  for (let s = firstSec; s <= endTime; s++) {
    if (s < 0) continue;
    out.push({ t: s, weight: 'major' });
  }
  return out;
}
