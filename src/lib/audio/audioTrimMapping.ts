/**
 * Audio Trim Mapping — pure helpers for the non-destructive timeline ↔ audio
 * recortation system.
 *
 * The project's "show clock" (`currentTime` in the store) always runs from
 * `0 .. duration`, where `duration = audioOutPoint - audioInPoint`. The
 * underlying `<audio>` element however exposes `currentTime` in the original
 * file's coordinate system (`0 .. audioOriginalDuration`). These three
 * one-liners are the bridge.
 *
 * Kept dependency-free so they can be exercised by unit tests without booting
 * Zustand or the audio pipeline.
 */

/** Map a show-time (timeline) instant to the original audio file instant. */
export function timelineToAudio(showTime: number, audioInPoint: number): number {
  return showTime + audioInPoint;
}

/** Map an audio file instant to the show-time (timeline) instant. */
export function audioToTimeline(audioTime: number, audioInPoint: number): number {
  return audioTime - audioInPoint;
}

/**
 * Clamp an audio file instant to the active trim window. `outPoint = null`
 * means "no out point set, use the original file end". `origDur` guards us
 * against unbounded values when the buffer hasn't been decoded yet.
 */
export function clampToTrim(
  audioTime: number,
  audioInPoint: number,
  audioOutPoint: number | null,
  audioOriginalDuration: number,
): number {
  const hi = audioOutPoint ?? audioOriginalDuration;
  return Math.min(hi, Math.max(audioInPoint, audioTime));
}

/** Effective duration of the show given the current trim window. */
export function effectiveDuration(
  audioInPoint: number,
  audioOutPoint: number | null,
  audioOriginalDuration: number,
): number {
  const out = audioOutPoint ?? audioOriginalDuration;
  return Math.max(0, out - audioInPoint);
}

/**
 * Validate a candidate trim window. Returns null if valid, otherwise a short
 * error message suitable for a toast/log line. Caller decides what to do.
 *
 * Rules:
 *   - both numbers must be finite
 *   - 0 ≤ inT < outT
 *   - outT ≤ origDur (when origDur is known)
 *   - window must be ≥ MIN_WINDOW_SEC (50 ms) to avoid divide-by-zero on the
 *     waveform downsample and unrenderable timelines
 */
export const MIN_TRIM_WINDOW_SEC = 0.05;

export function validateTrim(
  inT: number,
  outT: number,
  origDur: number | null,
): string | null {
  if (!Number.isFinite(inT) || !Number.isFinite(outT)) return 'Trim points must be finite numbers.';
  if (inT < 0) return 'In point cannot be negative.';
  if (outT <= inT) return 'Out point must be greater than In point.';
  if (outT - inT < MIN_TRIM_WINDOW_SEC) return `Trim window must be ≥ ${MIN_TRIM_WINDOW_SEC * 1000}ms.`;
  if (origDur != null && outT > origDur + 1e-3) return 'Out point exceeds audio length.';
  return null;
}
