/**
 * useReducedMotion / useReducedTransparency — defensive matchMedia wrappers.
 * Default false on environments where matchMedia is missing or throws.
 */
import { useEffect, useState } from 'react';

function safeMatchMedia(query: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.matchMedia?.(query)?.matches;
  } catch {
    return false;
  }
}

function useMediaFlag(query: string): boolean {
  const [v, setV] = useState(() => safeMatchMedia(query));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    let mql: MediaQueryList;
    try { mql = window.matchMedia(query); } catch { return; }
    const onChange = () => setV(mql.matches);
    onChange();
    try { mql.addEventListener('change', onChange); }
    catch { mql.addListener(onChange); }
    return () => {
      try { mql.removeEventListener('change', onChange); }
      catch { mql.removeListener(onChange); }
    };
  }, [query]);
  return v;
}

export const useReducedMotion = () =>
  useMediaFlag('(prefers-reduced-motion: reduce)');

export const useReducedTransparency = () =>
  useMediaFlag('(prefers-reduced-transparency: reduce)');
