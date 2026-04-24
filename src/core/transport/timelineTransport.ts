/**
 * ─── Timeline Transport Controller ──────────────────────────────────
 * Single operational entry point for timeline transport across desktop,
 * mobile and live overlays. Wraps `timelineClock` with UX-aware safeguards:
 *
 *   - Play autocorrects an invalid/zero speed back to the last valid speed
 *     (or 1×), so the UI never enters a "playing but frozen" state.
 *   - Play at end-of-duration auto-seeks to 0 (rewind-and-play), unless
 *     the timeline is in loop mode.
 *   - All direct `timelineClock.play/pause/toggle/seek(0)` calls in the UI
 *     should be replaced by this controller, ensuring a single audited
 *     transport path.
 *
 * The clock itself still accepts speed=0 (technical use cases like external
 * sync hold), so we don't change `setSpeed` semantics — we only correct the
 * speed at the moment the operator presses Play.
 */

import { timelineClock } from '@/core/timeline/TimelineClock';

const DEFAULT_PLAYBACK_SPEED = 1;
const END_EPSILON = 0.001;
const MIN_PLAYABLE_SPEED = 0.05;

let lastValidSpeed = DEFAULT_PLAYBACK_SPEED;
let lastAutoCorrection: 'speed' | 'rewind' | null = null;

function rememberSpeed(speed: number): void {
  if (Number.isFinite(speed) && speed >= MIN_PLAYABLE_SPEED) {
    lastValidSpeed = speed;
  }
}

/** Returns the last user-facing playable speed (≥0.05). */
export function getLastValidSpeed(): number {
  return lastValidSpeed;
}

/** Returns the last auto-correction applied by Play, or null. */
export function consumeLastAutoCorrection(): 'speed' | 'rewind' | null {
  const v = lastAutoCorrection;
  lastAutoCorrection = null;
  return v;
}

/**
 * Ensures the current speed is playable. If it isn't, restores the last
 * valid speed (or DEFAULT_PLAYBACK_SPEED). Returns whether a correction
 * was applied.
 */
export function ensurePlayableSpeed(): boolean {
  const { speed } = timelineClock.getState();
  if (Number.isFinite(speed) && speed >= MIN_PLAYABLE_SPEED) {
    rememberSpeed(speed);
    return false;
  }
  const restore = lastValidSpeed >= MIN_PLAYABLE_SPEED ? lastValidSpeed : DEFAULT_PLAYBACK_SPEED;
  timelineClock.setSpeed(restore);
  return true;
}

/**
 * If the timeline is at (or past) the end and not looping, seek back to 0
 * before playing. Returns whether a rewind was applied.
 */
export function playFromStartIfEnded(): boolean {
  const { time, duration, loop } = timelineClock.getState();
  if (loop) return false;
  if (duration > 0 && time >= duration - END_EPSILON) {
    timelineClock.seek(0);
    return true;
  }
  return false;
}

export function play(): void {
  lastAutoCorrection = null;
  const speedFixed = ensurePlayableSpeed();
  const rewound = playFromStartIfEnded();
  if (rewound) lastAutoCorrection = 'rewind';
  else if (speedFixed) lastAutoCorrection = 'speed';
  timelineClock.play();
}

export function pause(): void {
  timelineClock.pause();
}

export function toggle(): void {
  if (timelineClock.isPlaying()) pause();
  else play();
}

/** Pause and rewind to 0. */
export function stop(): void {
  timelineClock.pause();
  timelineClock.seek(0);
}

/** Alias of stop() — explicit name for UI semantics. */
export function rewind(): void {
  stop();
}

/** Pause + seek to a specific time. */
export function seekTo(time: number): void {
  timelineClock.seek(time);
}

export const timelineTransport = {
  play,
  pause,
  toggle,
  stop,
  rewind,
  seekTo,
  ensurePlayableSpeed,
  playFromStartIfEnded,
  getLastValidSpeed,
  consumeLastAutoCorrection,
};

export type TimelineTransport = typeof timelineTransport;
