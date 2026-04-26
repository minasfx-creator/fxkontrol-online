/**
 * useTimelineClockHealthCheck — watchdog for the master timeline clock.
 *
 * Companion to `useAudioMasterClock` and the lockstep `'playback'` subsystem.
 * The transport architecture has two possible drivers for `timelineClock.time`:
 *
 *   1. Audio master  — `useAudioMasterClock` pumps `syncExternalTime(audio.currentTime)`
 *      while the audio element is actually advancing.
 *   2. Lockstep playback — `PlaybackClock` advances the store directly when no
 *      audio is the master.
 *
 * Both paths are robust on their own, but a class of pathological states can
 * still leave the clock frozen even though `isPlaying === true`:
 *   - the audio element decoded but the browser silently halted playback
 *     (visibility change, hardware overrun, lossy network buffer underrun…);
 *   - the lockstep tick loop stalled (long task, broken raf in a hidden tab
 *     that just regained focus, etc.);
 *   - an external sync source claimed the clock and then disappeared without
 *     calling `releaseExternalSync()`.
 *
 * From the operator's POV the symptom is identical: "Play is on but the
 * timeline isn't moving". This watchdog detects that condition deterministically
 * and recovers automatically:
 *
 *   1. Sample `timelineClock.time` every `SAMPLE_INTERVAL_MS` while playing.
 *   2. If `time` does not advance for `STALL_THRESHOLD_MS`, declare a stall.
 *   3. Force the fallback path: `releaseExternalSync()` + re-enable the
 *      lockstep `'playback'` subsystem. This guarantees that the *local*
 *      clock will tick the timeline forward on the next lockstep frame.
 *   4. Surface a toast so the operator knows what happened (and that the
 *      show is recovering, not broken).
 *
 * Mount once at the editor root (after the engines are wired up). It is a
 * pure observer — it never advances time itself.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { useProjectStore } from '@/store/useProjectStore';

const PLAYBACK_SUBSYSTEM_ID = 'playback';

export interface TimelineClockHealthOptions {
  /** Milliseconds without forward progress before we declare a stall. */
  stallThresholdMs?: number;
  /** Polling interval in ms. */
  sampleIntervalMs?: number;
  /** Cooldown between consecutive recovery toasts to avoid spam. */
  recoveryCooldownMs?: number;
}

const DEFAULTS: Required<TimelineClockHealthOptions> = {
  stallThresholdMs: 750,
  sampleIntervalMs: 200,
  recoveryCooldownMs: 4000,
};

export function useTimelineClockHealthCheck(options: TimelineClockHealthOptions = {}) {
  const { stallThresholdMs, sampleIntervalMs, recoveryCooldownMs } = { ...DEFAULTS, ...options };

  // We intentionally read `isPlaying` from the store imperatively inside the
  // interval (not as a hook subscription) so the watchdog does not re-mount
  // on every play/pause toggle.
  const lastTimeRef = useRef<number>(timelineClock.getTime());
  const lastAdvancedAtRef = useRef<number>(performance.now());
  const lastRecoveryAtRef = useRef<number>(0);
  const recoveringRef = useRef<boolean>(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const state = useProjectStore.getState();
      if (!state.isPlaying) {
        // Reset the watchdog whenever playback is paused so we don't fire
        // spurious "stalled" toasts the moment the operator hits Play again.
        lastTimeRef.current = timelineClock.getTime();
        lastAdvancedAtRef.current = performance.now();
        recoveringRef.current = false;
        return;
      }

      const now = performance.now();
      const t = timelineClock.getTime();
      const clockState = timelineClock.getState();

      // End-of-timeline is *not* a stall — the clock is supposed to stop there.
      const atEnd = clockState.duration > 0 && t >= clockState.duration - 0.001;
      if (atEnd) {
        lastTimeRef.current = t;
        lastAdvancedAtRef.current = now;
        return;
      }

      if (t !== lastTimeRef.current) {
        lastTimeRef.current = t;
        lastAdvancedAtRef.current = now;
        recoveringRef.current = false;
        return;
      }

      const stalledFor = now - lastAdvancedAtRef.current;
      if (stalledFor < stallThresholdMs) return;

      // ── Stall detected ─ force the fallback path ────────────────────────
      // Skip if we just attempted recovery — give the lockstep a chance to
      // actually start advancing before we shout again.
      const sinceLastRecovery = now - lastRecoveryAtRef.current;
      if (recoveringRef.current && sinceLastRecovery < recoveryCooldownMs) return;

      recoveringRef.current = true;
      lastRecoveryAtRef.current = now;

      const wasExternal = clockState.source === 'external';
      // Release any stale external sync claim so the local clock owns time again.
      if (wasExternal) {
        timelineClock.releaseExternalSync();
      }
      // Make sure the lockstep playback subsystem is enabled — this is the
      // only path that can actually advance `timelineClock.time` without an
      // external master.
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);

      // Reset the sample so we don't immediately retrigger.
      lastTimeRef.current = timelineClock.getTime();
      lastAdvancedAtRef.current = now;

      const description = wasExternal
        ? 'External sync source stopped advancing. Switched to local playback to keep the show running.'
        : 'Timeline stopped advancing. Restarted the local playback driver.';
      toast.warning('Playback recovered', { description });
      console.warn(
        '[TimelineClockHealth] Stall detected after',
        Math.round(stalledFor),
        'ms — forced fallback to lockstep playback. wasExternal=',
        wasExternal,
      );
    }, sampleIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [stallThresholdMs, sampleIntervalMs, recoveryCooldownMs]);
}
