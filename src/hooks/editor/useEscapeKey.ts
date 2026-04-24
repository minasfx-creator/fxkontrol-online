/**
 * useEscapeKey — Invokes handler on Escape keydown.
 * Pass `enabled=false` to temporarily disable without remounting.
 */
import { useEffect } from 'react';

export function useEscapeKey(handler: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, enabled]);
}
