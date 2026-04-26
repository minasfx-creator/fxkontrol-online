/**
 * useAudioMasterClock — Drives the timeline from the audio element.
 *
 * When an `<audio>` element is loaded and playback is active, this hook makes
 * the audio's actual `currentTime` the master clock for the entire app:
 *
 *   audio.currentTime  ──►  timelineClock.syncExternalTime(t)
 *                               │
 *                               ▼
 *                  Zustand store currentTime  ──►  3D viewport, FX spawns
 *
 * Why: the previous design ran two independent clocks (RAF inside
 * `TimelineClock` + the lockstep "playback" subsystem) and the browser audio
 * pipeline as a third. They drift relative to each other within a few seconds,
 * so what the operator sees on the 3D viewport (effect spawns, drone
 * positions, camera animation) lags or leads the music.
 *
 * Pinning the timeline to `HTMLAudioElement.currentTime` is the only way to
 * guarantee zero perceptible drift between audio and visuals.
 *
 * Behaviour:
 *  - Active only while `audioRef.current` exists AND `isPlaying` is true AND
 *    the audio element is actually advancing (not stalled).
 *  - The lockstep `'playback'` subsystem is disabled while audio is master so
 *    it doesn't fight the external sync. It is re-enabled on pause/unmount.
 *  - On unmount or when audio is removed, `timelineClock.releaseExternalSync()`
 *    restores the local clock so the timeline keeps working without audio.
 */
import { useEffect, type RefObject } from 'react';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { useProjectStore } from '@/store/useProjectStore';

const PLAYBACK_SUBSYSTEM_ID = 'playback';

export function useAudioMasterClock(
  audioRef: RefObject<HTMLAudioElement | null>,
  audioUrl: string | null,
) {
  const isPlaying = useProjectStore((s) => s.isPlaying);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audioUrl || !audio || !isPlaying) {
      // Not in audio-master mode → make sure lockstep playback is running and
      // the clock is not stuck following a stale external source.
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);
      return;
    }

    // Hand the master clock over to the audio element.
    lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, false);

    let rafId = 0;
    const pump = () => {
      const a = audioRef.current;
      if (!a) return;
      // `audio.currentTime` is in seconds, monotonic while playing, and
      // already accounts for `playbackRate` and any browser scheduling jitter.
      timelineClock.syncExternalTime(a.currentTime);
      rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);

    return () => {
      cancelAnimationFrame(rafId);
      // Pause flow: release external sync so the timeline's local source
      // takes over (operator may scrub, the lockstep clock resumes).
      timelineClock.releaseExternalSync();
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);
    };
  }, [audioRef, audioUrl, isPlaying]);
}
