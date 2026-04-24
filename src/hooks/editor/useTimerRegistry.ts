/**
 * useTimerRegistry — Centralized setTimeout registry with auto-cleanup on unmount.
 * Prevents leaks when scheduling many ad-hoc timers (e.g. per-cue fire windows).
 */
import { useCallback, useEffect, useRef } from 'react';

export interface TimerRegistry {
  /** Schedule a timer under `key`. Cancels any prior timer with the same key. */
  set: (key: string, fn: () => void, delayMs: number) => void;
  /** Clear a timer by key. */
  clear: (key: string) => void;
  /** Clear every registered timer. */
  clearAll: () => void;
  /** True if a timer is registered under `key`. */
  has: (key: string) => boolean;
}

export function useTimerRegistry(): TimerRegistry {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clear = useCallback((key: string) => {
    const t = timersRef.current.get(key);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(key);
    }
  }, []);

  const set = useCallback((key: string, fn: () => void, delayMs: number) => {
    clear(key);
    const t = setTimeout(() => {
      timersRef.current.delete(key);
      fn();
    }, delayMs);
    timersRef.current.set(key, t);
  }, [clear]);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const has = useCallback((key: string) => timersRef.current.has(key), []);

  useEffect(() => () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { set, clear, clearAll, has };
}
