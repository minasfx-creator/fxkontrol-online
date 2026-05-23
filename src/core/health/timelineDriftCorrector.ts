/**
 * timelineDriftCorrector — gradual re-alignment of `timelineClock.time` to a
 * target time source (typically `audio.currentTime`) after a watchdog
 * recovery, so the operator never sees a perceptible jump on the timeline
 * cursor / 3D viewport.
 *
 * Why
 *   The previous recovery path called `timelineClock.seek(audio.currentTime)`,
 *   which is correct for *sync* but visually jarring: the playhead, the
 *   ribbon-trail particles, the camera animation curves, and any FX that key
 *   off the current time would all snap to a new position in a single frame.
 *   For audio-led shows the audio offset after recovery is usually small
 *   (a few hundred ms at most), small enough that we can absorb it over
 *   ~1.5 s without anyone noticing — but big enough that a hard seek feels
 *   like a glitch.
 *
 * How
 *   While a correction is active the corrector RAF-pumps
 *   `timelineClock.syncExternalTime(blended)` every frame, where:
 *
 *     blended = clockTime + (target - clockTime) * easedAlpha
 *
 *   with `easedAlpha` running from 0 to 1 over `durationMs` using a smooth
 *   ease-in-out curve. The pump also follows the live `target` callback so
 *   that audio progress during the correction is honoured (we are catching
 *   up to a *moving* target, not a frozen sample).
 *
 *   Once `alpha === 1` the corrector calls `releaseExternalSync()` so the
 *   normal `useAudioMasterClock` RAF can take ownership of the clock again
 *   (it will, on the very next frame, because the audio is advancing).
 *
 * Bounds
 *   - If the offset is below `IGNORE_THRESHOLD_S` (~16 ms) the correction
 *     is skipped — the discrepancy is below visual perception.
 *   - If the offset is above `MAX_SOFT_OFFSET_S` (default 3 s) the corrector
 *     refuses to absorb it gracefully and falls back to a hard seek; that
 *     much drift means something else is wrong (lost audio, scrubbed source)
 *     and pretending to glide there would only confuse the operator.
 *
 * This module is purely a *renderer-side* concern. It does NOT change the
 * watchdog's recovery decision, NOR the `audioMasterRegistry.resyncTimeline()`
 * audio.play() retry path. It only smooths the visual transition that
 * follows a recovery.
 */

import { timelineClock } from '@/core/timeline/TimelineClock';

const IGNORE_THRESHOLD_S = 0.016;   // ≈1 frame @ 60 fps
const DEFAULT_DURATION_MS = 1500;
const MAX_SOFT_OFFSET_S = 3;

export interface DriftCorrectionRequest {
  /** Live getter for the desired clock time (e.g. () => audio.currentTime). */
  getTarget: () => number;
  /** Total ramp duration. Defaults to 1500 ms. */
  durationMs?: number;
  /** Called with the result so the watchdog can log/react. */
  onSettled?: (result: 'completed' | 'skipped' | 'cancelled' | 'hard-seek') => void;
}

interface ActiveCorrection extends Required<Omit<DriftCorrectionRequest, 'onSettled'>> {
  startedAt: number;
  startClockTime: number;
  startOffset: number; // target - startClockTime, captured at start
  rafId: number;
  onSettled?: (result: 'completed' | 'skipped' | 'cancelled' | 'hard-seek') => void;
}

let active: ActiveCorrection | null = null;
let enabled = true;

function easeInOut(t: number): number {
  // Smoothstep — soft start, soft stop, no overshoot. Good enough for visual
  // cursor/camera blending; we do not need true cubic-bezier control.
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function settle(result: 'completed' | 'skipped' | 'cancelled' | 'hard-seek') {
  const cb = active?.onSettled;
  if (active) cancelAnimationFrame(active.rafId);
  active = null;
  cb?.(result);
}

function pump() {
  if (!active) return;
  const now = performance.now();
  const elapsed = now - active.startedAt;
  const rawAlpha = Math.min(1, elapsed / active.durationMs);
  const alpha = easeInOut(rawAlpha);

  const target = active.getTarget();
  if (!Number.isFinite(target)) {
    // Source disappeared mid-correction — release and bail.
    timelineClock.releaseExternalSync();
    settle('cancelled');
    return;
  }

  const clockTime = timelineClock.getTime();
  const blended = clockTime + (target - clockTime) * alpha;
  timelineClock.syncExternalTime(blended);

  if (rawAlpha >= 1) {
    // Hand the clock back so `useAudioMasterClock` can resume normal pumping
    // on its next RAF. We do NOT snap to `target` here — the next RAF will
    // call syncExternalTime(target) anyway.
    timelineClock.releaseExternalSync();
    settle('completed');
    return;
  }

  active.rafId = requestAnimationFrame(pump);
}

/**
 * Begin (or replace) a drift correction toward `getTarget()`.
 * Returns the result kind of *this scheduling decision* (whether we'll run a
 * correction, skip it, or perform a hard seek). `onSettled` is invoked when
 * the correction finishes/aborts.
 */
export function startDriftCorrection(
  req: DriftCorrectionRequest,
): 'started' | 'skipped' | 'hard-seek' | 'disabled' {
  if (!enabled) {
    req.onSettled?.('skipped');
    return 'disabled';
  }

  const target = req.getTarget();
  if (!Number.isFinite(target)) {
    req.onSettled?.('skipped');
    return 'skipped';
  }

  const clockTime = timelineClock.getTime();
  const offset = target - clockTime;
  const absOffset = Math.abs(offset);

  if (absOffset < IGNORE_THRESHOLD_S) {
    req.onSettled?.('skipped');
    return 'skipped';
  }

  if (absOffset > MAX_SOFT_OFFSET_S) {
    // Too far apart to glide gracefully — perform the snap the watchdog
    // would have done in the first place.
    timelineClock.seek(target);
    req.onSettled?.('hard-seek');
    return 'hard-seek';
  }

  // Cancel any in-flight correction first so we don't stack pumps.
  if (active) settle('cancelled');

  active = {
    getTarget: req.getTarget,
    durationMs: req.durationMs ?? DEFAULT_DURATION_MS,
    startedAt: performance.now(),
    startClockTime: clockTime,
    startOffset: offset,
    rafId: 0,
    onSettled: req.onSettled,
  };
  active.rafId = requestAnimationFrame(pump);
  return 'started';
}

export function cancelDriftCorrection(): void {
  if (active) settle('cancelled');
}

export function isDriftCorrecting(): boolean {
  return active !== null;
}

export function setDriftCorrectionEnabled(value: boolean): void {
  enabled = value;
  if (!enabled && active) settle('cancelled');
}

export function isDriftCorrectionEnabled(): boolean {
  return enabled;
}

export const DRIFT_CORRECTION_BOUNDS = {
  durationMs: { min: 250, max: 5000, step: 50 },
} as const;

export const DRIFT_CORRECTION_DEFAULTS = {
  durationMs: DEFAULT_DURATION_MS,
} as const;
