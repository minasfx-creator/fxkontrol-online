/**
 * useWindowEvent — Typed wrapper for window.addEventListener with auto-cleanup.
 * Pass `enabled=false` to skip subscription without remounting.
 */
import { useEffect } from 'react';

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(type, handler as EventListener, options);
    return () => window.removeEventListener(type, handler as EventListener, options);
  }, [type, handler, options, enabled]);
}
