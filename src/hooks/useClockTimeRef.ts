/**
 * Frame-time hooks — give renderers a *direct, lock-free* read of the
 * authoritative timeline time inside `useFrame`, bypassing React/Zustand
 * scheduling.
 *
 * Why two reads (clock + store)?
 *   - The store mirror (`useProjectStore.currentTime`) is the canonical UI
 *     value: stable across React renders, drives memo deps, and powers the
 *     scrubber / timecode HUD.
 *   - But Zustand notifications go through React's render batching, so a
 *     given `useFrame` invocation can run with a `currentTime` that is up
 *     to 1 frame behind `timelineClock.time` (the value the RAF pump just
 *     wrote in `EngineProvider`).
 *
 * `useClockTimeRef()` returns a ref whose `.current` is always the freshest
 * `timelineClock.getTime()` — read it inside `useFrame` for compute, and
 * keep using the store value for everything React-rendered.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import { timelineClock } from '@/core/timeline/TimelineClock';

/**
 * Returns a ref whose `.current` always equals `timelineClock.getTime()`.
 *
 * - Initialized synchronously to the current clock time (no flash of zero on mount).
 * - Updated by subscribing to `timelineClock.onChange` — every clock tick (RAF
 *   pump in EngineProvider) immediately writes the new time into `.current`.
 * - Lock-free read: dereference inside `useFrame` with no allocation.
 *
 * Falls back to `0` if the clock hasn't ticked yet.
 */
export function useClockTimeRef(): MutableRefObject<number> {
  const ref = useRef<number>(timelineClock.getTime());
  useEffect(() => {
    // Sync immediately in case the clock advanced between render and effect.
    ref.current = timelineClock.getTime();
    return timelineClock.onChange((state) => {
      ref.current = state.time;
    });
  }, []);
  return ref;
}

/**
 * Returns a ref whose `.current` is `true` while the clock is playing.
 * Useful for renderers that gate behaviour on transport state without
 * causing a React re-render every play/pause.
 */
export function useClockPlayingRef(): MutableRefObject<boolean> {
  const ref = useRef<boolean>(timelineClock.isPlaying());
  useEffect(() => {
    ref.current = timelineClock.isPlaying();
    return timelineClock.onChange((state) => {
      ref.current = state.playing;
    });
  }, []);
  return ref;
}
