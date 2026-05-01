/**
 * useInterval — leak-safe setInterval for React components.
 *
 * Replaces the common pattern:
 *   useEffect(() => {
 *     const id = setInterval(fn, 1000);
 *     return () => clearInterval(id);
 *   }, [...]);
 *
 * with:
 *   useInterval(fn, 1000);          // pass null to pause
 *
 * Guarantees:
 * - Always cleared on unmount
 * - Stable reference (callback ref pattern) — fn updates do not restart the interval
 * - delay=null pauses without tearing down the component
 * - Uses useRef for the timer id (per Core memory rule)
 */
import { useEffect, useRef, useCallback } from 'react';

export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>(callback);

  // Always keep the latest callback without restarting the timer
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || delay <= 0) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * useTimeout — leak-safe setTimeout for React components.
 * delay=null cancels.
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null || delay < 0) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

/**
 * useImperativeInterval — manual start/stop control with ref-based timer.
 * Use when you need to start/stop based on user action, not props/state.
 */
export function useImperativeInterval(): {
  start: (cb: () => void, delay: number) => void;
  stop: () => void;
  isRunning: () => boolean;
} {
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (idRef.current !== null) {
      clearInterval(idRef.current);
      idRef.current = null;
    }
  }, []);

  const start = useCallback((cb: () => void, delay: number) => {
    stop();
    idRef.current = setInterval(cb, delay);
  }, [stop]);

  const isRunning = useCallback(() => idRef.current !== null, []);

  // Always cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { start, stop, isRunning };
}
