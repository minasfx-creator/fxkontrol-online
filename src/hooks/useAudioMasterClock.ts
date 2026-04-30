/**
 * useAudioMasterClock — Drives the timeline from the audio element.
 *
 * When an `<audio>` element is loaded and *actually advancing*, this hook makes
 * the audio's actual `currentTime` the master clock for the entire app:
 *
 *   audio.currentTime  ──►  timelineClock.syncExternalTime(t)
 *                               │
 *                               ▼
 *                  Zustand store currentTime  ──►  3D viewport, FX spawns
 *
 * Why pin the timeline to the audio element?
 *  The previous design ran two independent clocks (RAF inside `TimelineClock`
 *  + the lockstep "playback" subsystem) and the browser audio pipeline as a
 *  third. They drift relative to each other within a few seconds, so what the
 *  operator sees on the 3D viewport (effect spawns, drone positions, camera
 *  animation) lags or leads the music.
 *  Pinning the timeline to `HTMLAudioElement.currentTime` while the audio is
 *  truly progressing is the only way to guarantee zero perceptible drift.
 *
 * ─── Hardening (Apr-2026) ──────────────────────────────────────────────────
 * Hard-learned bug: when the operator pressed Play but the browser refused to
 * start audio (autoplay gesture rejection, unlocked-context error, decode
 * stall…), `audio.play()` rejected silently, `audio.currentTime` stayed at 0,
 * and this hook kept calling `syncExternalTime(0)` every RAF — which pinned
 * the timeline to 0 and made the entire show *look* frozen even though
 * `isPlaying === true` in the store. From the operator's POV "Play didn't
 * work".
 *
 * The hook now refuses to drive the clock when the audio is *not* advancing,
 * letting the lockstep `'playback'` subsystem own the timeline as a fallback.
 * It also no longer overrides `playbackSpeed` to 1 (the audio element already
 * mirrors `playbackSpeed` via `playbackRate`, and `syncExternalTime` only
 * needs to *follow* it, not reset it).
 *
 * Behaviour:
 *  - Active only while `audioRef.current` exists, `isPlaying` is true, *and*
 *    the audio element is actually advancing (paused=false, readyState>=2,
 *    last `currentTime` !== current `currentTime` over a short window).
 *  - The lockstep `'playback'` subsystem is disabled while audio is master so
 *    it doesn't fight the external sync. It is re-enabled the moment the
 *    audio stops advancing (stall, autoplay block, end-of-stream) so the
 *    timeline keeps moving.
 *  - On unmount or when audio is removed, `timelineClock.releaseExternalSync()`
 *    restores the local clock so the timeline keeps working without audio.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { useProjectStore } from '@/store/useProjectStore';

const PLAYBACK_SUBSYSTEM_ID = 'playback';
/** If `audio.currentTime` doesn't advance for this many ms, we consider the
 *  audio stalled and hand the clock back to the lockstep playback subsystem. */
const STALL_TIMEOUT_MS = 350;

export function useAudioMasterClock(
  audioRef: RefObject<HTMLAudioElement | null>,
  audioUrl: string | null,
) {
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const audioMasterActiveRef = useRef(false);
  // Stale-frame guard: when `isPlaying` flips to false the effect tears down
  // RAF, but on a heavy frame the next pump can still fire once before the
  // cleanup runs. The closure read of `isPlaying` is stale (true), so without
  // this ref the pump pushes one extra `syncExternalTime(t)` after pause —
  // visibly bumping the playhead by ~16 ms when the operator stops playback.
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audioUrl || !audio || !isPlaying) {
      // Not in audio-master mode → make sure lockstep playback is running and
      // the clock is not stuck following a stale external source.
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);
      if (audioMasterActiveRef.current) {
        timelineClock.releaseExternalSync();
        audioMasterActiveRef.current = false;
      }
      return;
    }

    let rafId = 0;
    let lastSampledTime = audio.currentTime;
    let lastSampledAt = performance.now();
    let masterEngaged = false;

    const engageMaster = () => {
      if (masterEngaged) return;
      masterEngaged = true;
      audioMasterActiveRef.current = true;
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, false);
    };

    const disengageMaster = () => {
      if (!masterEngaged) return;
      masterEngaged = false;
      audioMasterActiveRef.current = false;
      // Release before re-enabling lockstep so the local clock takes over
      // from `timelineClock.time` (which `syncExternalTime` last wrote) and
      // resumes ticking from there instead of snapping back to 0.
      timelineClock.releaseExternalSync();
      lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);
    };

    // ─── Eager engage (Apr-2026) ─────────────────────────────────────
    // O AudioWaveform já chama `lockstep.setEnabled('playback', false)` +
    // `timelineClock.syncExternalTime(currentTime)` no mesmo frame em que
    // chama `audio.play()`. Aqui a gente apenas marca o pump como master
    // imediatamente — sem esperar o "advanced detection" de 1–2 RAFs —
    // pra que o estado interno do hook esteja consistente com o que o
    // AudioWaveform já fez. O fallback de stall continua valendo: se o
    // áudio realmente não avançar dentro de STALL_TIMEOUT_MS, a gente
    // disengage e o lockstep reassume.
    if (!audio.paused && audio.readyState >= 2) {
      engageMaster();
    }

    const pump = () => {
      const a = audioRef.current;
      // Stale-frame guard: bail immediately if Play was toggled off between
      // the previous RAF and this one (cleanup races with a queued pump on
      // heavy frames). Without this we'd push one extra `syncExternalTime`
      // after the operator pressed Pause.
      if (!a || !isPlayingRef.current) {
        disengageMaster();
        return;
      }

      const now = performance.now();
      const t = a.currentTime;

      // Detect whether the audio is actually progressing. We sample on every
      // RAF and only treat the audio as "advancing" when:
      //   - it is not paused
      //   - it has decoded enough data to play (readyState >= HAVE_CURRENT_DATA)
      //   - currentTime has moved since the last sample, OR we are still
      //     within the stall grace window of the last forward movement.
      const advanced = t !== lastSampledTime;
      if (advanced) {
        lastSampledTime = t;
        lastSampledAt = now;
      }
      const withinGrace = now - lastSampledAt < STALL_TIMEOUT_MS;
      const isAdvancing = !a.paused && a.readyState >= 2 && (advanced || withinGrace);

      if (isAdvancing) {
        engageMaster();
        // `audio.currentTime` is in seconds in the *original audio file*
        // coordinate system. The store's `currentTime` is in *show time*,
        // which equals `audioStartOffset + (audioTime - audioInPoint)` once
        // a non-destructive trim and/or a ruler-drop start offset are
        // applied. We read both on every pump so adjustments take effect
        // instantly without tearing down the RAF loop.
        const st = useProjectStore.getState();
        const inP = st.audioInPoint;
        const startOffset = st.audioStartOffset;
        timelineClock.syncExternalTime(startOffset + (t - inP));
      } else if (masterEngaged) {
        // Audio is no longer advancing (autoplay block, stall, decode error).
        // Hand the timeline back to the lockstep so the show keeps moving.
        disengageMaster();
      }

      rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);

    return () => {
      cancelAnimationFrame(rafId);
      disengageMaster();
    };
  }, [audioRef, audioUrl, isPlaying]);
}
