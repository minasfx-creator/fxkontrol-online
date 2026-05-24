/**
 * useShowTimeRef — Imperative bridge from useProjectStore.currentTime
 * to a `ref.current` updated synchronously on every store change.
 *
 * Why a ref?
 * ──────────
 * R3F layers (LightPointsLayer, ExplosionsLayer) read time inside `useFrame`
 * which runs on the WebGL render loop. Subscribing to the store via the
 * Zustand React hook would re-render the React tree at the timeline clock
 * rate (60+ Hz), thrashing reconciliation. A ref lets us read the latest
 * value with zero React work.
 *
 * Pause behavior
 * ──────────────
 * `currentTime` simply stops changing when timelineClock is paused, so the
 * ref freezes too — particles naturally lock in place.
 *
 * Scrub behavior
 * ──────────────
 * Any store write to `currentTime` (from Topbar transport, Timeline click,
 * audio master clock pump) updates `ref.current` in the same microtask, and
 * the next R3F frame reads the new time → instant snap.
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';

export interface ShowTimeRef {
  /** Latest `currentTime` from the store (seconds). */
  time: number;
  /** Latest `isPlaying` flag from the store. */
  playing: boolean;
}

export function useShowTimeRef(): React.MutableRefObject<ShowTimeRef> {
  const ref = useRef<ShowTimeRef>({
    time: useProjectStore.getState().currentTime,
    playing: useProjectStore.getState().isPlaying,
  });

  useEffect(() => {
    // Seed with current store state on mount.
    const s0 = useProjectStore.getState();
    ref.current.time = s0.currentTime;
    ref.current.playing = s0.isPlaying;

    // Subscribe to the whole store; cheap because we only read two fields.
    const unsub = useProjectStore.subscribe((s) => {
      ref.current.time = s.currentTime;
      ref.current.playing = s.isPlaying;
    });
    return unsub;
  }, []);

  return ref;
}
