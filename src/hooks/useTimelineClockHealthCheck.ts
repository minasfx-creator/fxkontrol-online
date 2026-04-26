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
import { getAudioMaster, resyncTimeline } from '@/lib/audio/audioMasterRegistry';
import { timelineHealthStore } from '@/core/health/timelineHealthStore';

const PLAYBACK_SUBSYSTEM_ID = 'playback';
/** How long the badge stays in 'recovered' state after a successful recovery
 *  before falling back to 'running'. Pure UX value — does not affect any
 *  recovery logic. */
const RECOVERED_DISPLAY_MS = 2500;

export interface TimelineClockHealthOptions {
  /** Milliseconds without forward progress before we declare a stall. */
  stallThresholdMs?: number;
  /** Polling interval in ms. */
  sampleIntervalMs?: number;
  /** Cooldown between consecutive recovery toasts to avoid spam. */
  recoveryCooldownMs?: number;
}

export function useTimelineClockHealthCheck(options: TimelineClockHealthOptions = {}) {
  // Operator-tunable defaults from the persisted settings store. Explicit
  // `options` (e.g. from tests) still win over the operator preference.
  const settings = useTimelineHealthSettings();
  const stallThresholdMs   = options.stallThresholdMs   ?? settings.stallThresholdMs;
  const sampleIntervalMs   = options.sampleIntervalMs   ?? settings.sampleIntervalMs;
  const recoveryCooldownMs = options.recoveryCooldownMs ?? settings.recoveryCooldownMs;

  // We intentionally read `isPlaying` from the store imperatively inside the
  // interval (not as a hook subscription) so the watchdog does not re-mount
  // on every play/pause toggle.
  const lastTimeRef = useRef<number>(timelineClock.getTime());
  const lastAdvancedAtRef = useRef<number>(performance.now());
  const lastRecoveryAtRef = useRef<number>(0);
  const recoveringRef = useRef<boolean>(false);

  useEffect(() => {
    let recoveredUntil = 0;
    const intervalId = window.setInterval(() => {
      const state = useProjectStore.getState();
      if (!state.isPlaying) {
        // Reset the watchdog whenever playback is paused so we don't fire
        // spurious "stalled" toasts the moment the operator hits Play again.
        lastTimeRef.current = timelineClock.getTime();
        lastAdvancedAtRef.current = performance.now();
        recoveringRef.current = false;
        recoveredUntil = 0;
        timelineHealthStore._set({ status: 'idle', stalledForMs: 0 });
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
        timelineHealthStore._set({ status: 'idle', stalledForMs: 0 });
        return;
      }

      if (t !== lastTimeRef.current) {
        lastTimeRef.current = t;
        lastAdvancedAtRef.current = now;
        recoveringRef.current = false;
        // After a successful recovery we keep the 'recovered' badge for a
        // short window so the operator actually notices it before the badge
        // settles on 'running'.
        const status: 'running' | 'recovered' = now < recoveredUntil ? 'recovered' : 'running';
        timelineHealthStore._set({ status, stalledForMs: 0 });
        return;
      }

      const stalledFor = now - lastAdvancedAtRef.current;
      if (stalledFor < stallThresholdMs) {
        // Still under threshold but not advancing this tick → keep
        // running/recovered status; only update stalledForMs for tooltip use.
        timelineHealthStore._set({ stalledForMs: Math.round(stalledFor) });
        return;
      }

      // ── Stall detected ─ force the fallback path ────────────────────────
      // Skip if we just attempted recovery — give the lockstep a chance to
      // actually start advancing before we shout again.
      const sinceLastRecovery = now - lastRecoveryAtRef.current;
      if (recoveringRef.current && sinceLastRecovery < recoveryCooldownMs) {
        timelineHealthStore._set({ status: 'stalled', stalledForMs: Math.round(stalledFor) });
        return;
      }

      recoveringRef.current = true;
      lastRecoveryAtRef.current = now;

      const wasExternal = clockState.source === 'external';
      const audio = getAudioMaster();

      // Prefer the audio-aware resync path when an audio master is registered:
      // it snaps `timelineClock.time` to `audio.currentTime` *and* retries
      // `audio.play()` with backoff, so the show continues with audio rather
      // than silently dropping to a muted lockstep fallback.
      if (audio) {
        const result = resyncTimeline({
          surfaceToasts: false,
          reason: `Watchdog detected ${Math.round(stalledFor)}ms stall.`,
        });
        toast.warning('Timeline resynced', {
          description: wasExternal
            ? 'External audio stopped advancing. Re-locked clock to audio and retried playback.'
            : 'Playback stalled. Re-locked clock to audio and retried playback.',
        });
        console.warn(
          '[TimelineClockHealth] Stall after',
          Math.round(stalledFor),
          'ms — auto-resync result:',
          result,
        );
      } else {
        // No audio master: fall back to the local lockstep path.
        if (wasExternal) timelineClock.releaseExternalSync();
        lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);
        toast.warning('Playback recovered', {
          description: wasExternal
            ? 'External sync source stopped advancing. Switched to local playback to keep the show running.'
            : 'Timeline stopped advancing. Restarted the local playback driver.',
        });
        console.warn(
          '[TimelineClockHealth] Stall after',
          Math.round(stalledFor),
          'ms — forced lockstep fallback (no audio master).',
        );
      }

      // Mark the badge as 'recovered' for a short window so the operator
      // sees that the watchdog actually intervened. The next advancing tick
      // will downgrade it to 'running'.
      recoveredUntil = now + RECOVERED_DISPLAY_MS;
      timelineHealthStore._set({
        status: 'recovered',
        stalledForMs: Math.round(stalledFor),
        lastRecoveryPath: audio ? 'audio-resync' : 'lockstep-fallback',
      });

      // Reset the sample so we don't immediately retrigger.
      lastTimeRef.current = timelineClock.getTime();
      lastAdvancedAtRef.current = now;
    }, sampleIntervalMs);

    return () => {
      window.clearInterval(intervalId);
      timelineHealthStore._set({ status: 'idle', stalledForMs: 0 });
    };
  }, [stallThresholdMs, sampleIntervalMs, recoveryCooldownMs]);
}
