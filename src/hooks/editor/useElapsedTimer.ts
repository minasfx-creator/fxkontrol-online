/**
 * useElapsedTimer — Periodic tick (default 1s) returning ms elapsed since `startTime`.
 * Pass `startTime=null` to pause/reset (returns 0).
 */
import { useEffect, useState } from 'react';

export function useElapsedTimer(startTime: number | null, intervalMs: number = 1000): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime == null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startTime);
    const id = setInterval(() => setElapsed(Date.now() - startTime), intervalMs);
    return () => clearInterval(id);
  }, [startTime, intervalMs]);

  return elapsed;
}
