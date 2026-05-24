/**
 * useActiveDemoSession — read-only sniff into Strategic Hub's active session.
 * Reads `localStorage.fxk.strategy.activeSessionId` and returns a tiny shape.
 * Pure observer; never writes. Returns null when no session is selected.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fxk.strategy.activeSessionId';
const META_KEY = 'fxk.strategy.activeSessionMeta';

export interface ActiveSessionMeta {
  id: string;
  clientName?: string;
  claim?: 'validated' | 'pilot' | 'marketing_hypothesis';
}

function read(): ActiveSessionMeta | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return null;
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveSessionMeta;
      if (parsed?.id === id) return parsed;
    }
    return { id };
  } catch { return null; }
}

export function useActiveDemoSession(): ActiveSessionMeta | null {
  const [meta, setMeta] = useState<ActiveSessionMeta | null>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === META_KEY) setMeta(read());
    };
    const interval = window.setInterval(() => setMeta(read()), 4000);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);
  return meta;
}
