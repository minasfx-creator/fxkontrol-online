/**
 * useShow3DEngineSync — bridges the global timeline/audio clock to a
 * `Show3DEngine` instance.
 *
 * Why this exists
 * ───────────────
 * The Show3DEngine has its own RAF that auto-advances `showTime` (used by
 * the standalone preview pages, e.g. `/dev/golden-shows`). The main editor
 * has a *different* canonical clock: `useProjectStore.currentTime` — which
 * is itself driven by `timelineClock`, which (when audio is loaded) is
 * pinned to `audio.currentTime` via `useAudioMasterClock`.
 *
 * If we let both clocks tick independently, the 3D viewport drifts vs. the
 * music within a few seconds and Particle Explosions / Light Points fire
 * out of sync with the audio waveform.
 *
 * Contract
 * ────────
 * While this hook is mounted with a non-null engine ref:
 *
 *  1. The engine is held in *paused* state (its internal RAF won't advance
 *     `showTime`). We become the sole driver.
 *  2. Every project-store update of `currentTime` triggers `engine.seek(t)`:
 *       - small forward delta → `mode: 'playback'` (newly-crossed cues fire,
 *         so Particle Explosions appear exactly when the audio crosses their
 *         scheduled startTime).
 *       - backward jump or large forward jump (> SCRUB_THRESHOLD_S) →
 *         `mode: 'scrub'` (effects layer wiped & re-spawned for `t`).
 *  3. `playbackSpeed` is forwarded to `engine.setRate(...)` so future
 *     internal-driven previews (loop region preview, etc.) keep the same
 *     cadence.
 *  4. `isPlaying` is mirrored visually only — we don't call `engine.play()`,
 *     because the *clock* (audio or RAF) is what advances time. The
 *     transport snapshot listeners on the engine still emit `playing: true`
 *     because they observe our explicit `engine.setPlayingMirror(true)`.
 *     (See companion change in Show3DEngine.)
 */
import { useEffect, useRef } from 'react';
import { Show3DEngine } from '@/lib/showEngine/Show3DEngine';
import { useProjectStore } from '@/store/useProjectStore';

/** Forward jump beyond this delta (s) is treated as a scrub, not a play tick. */
const SCRUB_THRESHOLD_S = 0.35;

export function useShow3DEngineSync(
  engineRef: React.RefObject<Show3DEngine | null>,
  enabled: boolean = true,
): void {
  const lastAppliedRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled) return;

    let unsub: (() => void) | null = null;
    let cancelled = false;

    // The engine may not be initialized on first render — poll briefly.
    const attach = () => {
      if (cancelled) return;
      const engine = engineRef.current;
      if (!engine) {
        requestAnimationFrame(attach);
        return;
      }

      // Seed: snap engine to the current store time so the first project
      // update doesn't trigger a phantom scrub.
      const seed = useProjectStore.getState();
      try {
        engine.setRate(seed.playbackSpeed > 0 ? seed.playbackSpeed : 1);
        engine.seek(seed.currentTime, { mode: 'scrub' });
        engine.setPlayingMirror(seed.isPlaying);
      } catch {
        /* engine not ready (no plan) — re-applied on next store change */
      }
      lastAppliedRef.current = seed.currentTime;

      unsub = useProjectStore.subscribe((state, prev) => {
        const e = engineRef.current;
        if (!e) return;

        // Rate
        if (state.playbackSpeed !== prev.playbackSpeed && state.playbackSpeed > 0) {
          e.setRate(state.playbackSpeed);
        }

        // Play mirror
        if (state.isPlaying !== prev.isPlaying) {
          e.setPlayingMirror(state.isPlaying);
        }

        // Time → cue dispatch
        if (state.currentTime !== prev.currentTime) {
          const last = lastAppliedRef.current;
          const delta = state.currentTime - last;
          const mode: 'playback' | 'scrub' =
            delta > 0 && delta <= SCRUB_THRESHOLD_S ? 'playback' : 'scrub';
          try {
            e.seek(state.currentTime, { mode });
          } catch {
            /* engine paused/not-loaded — ignore */
          }
          lastAppliedRef.current = state.currentTime;
        }
      });
    };

    attach();
    return () => {
      cancelled = true;
      unsub?.();
      // Release the play-mirror so the standalone engine can resume autonomy
      // if the host is re-mounted in non-synced mode (e.g. Phase 1 preview).
      engineRef.current?.setPlayingMirror(false);
    };
  }, [engineRef, enabled]);
}
