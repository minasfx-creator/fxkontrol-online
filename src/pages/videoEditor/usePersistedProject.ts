/**
 * usePersistedProject — Persiste positions + timelineItems + duration do
 * VideoEditor em localStorage, hidrata na montagem e escreve com debounce.
 *
 * Chave única `fxk.videoEditor.project.v1`. Versão `v` no payload permite
 * migração futura sem quebrar projetos antigos. Nunca persiste estado de
 * playback (currentTime/isPlaying/audioUrl) — só a "obra".
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { timelineClock } from '@/core/timeline/TimelineClock';

const STORAGE_KEY = 'fxk.videoEditor.project.v1';
const SCHEMA_VERSION = 1;
const WRITE_DEBOUNCE_MS = 250;

interface PersistedProject {
  v: number;
  positions: unknown[];
  timelineItems: unknown[];
  duration: number;
}

function loadFromStorage(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedProject;
    if (parsed?.v !== SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.positions) || !Array.isArray(parsed.timelineItems)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @returns `true` once hydration has been attempted (regardless of whether
 *          stored data was found). Lets the caller skip the demo seed when
 *          we restored real content.
 */
export function usePersistedProject(): { hydrated: boolean; restored: boolean } {
  const hydratedRef = useRef(false);
  const restoredRef = useRef(false);

  // Synchronous hydration on first render — must run before the demo-seed
  // effect so we don't overwrite restored items.
  if (!hydratedRef.current) {
    hydratedRef.current = true;
    const stored = loadFromStorage();
    if (stored && stored.timelineItems.length + stored.positions.length > 0) {
      restoredRef.current = true;
      const dur = Number.isFinite(stored.duration) && stored.duration > 0 ? stored.duration : 12;
      useProjectStore.setState({
        positions: stored.positions as never,
        timelineItems: stored.timelineItems as never,
        duration: dur,
      });
      try { timelineClock.setDuration(dur); } catch { /* clock not ready */ }
    }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSerialized = '';

    const flush = () => {
      timer = null;
      const s = useProjectStore.getState();
      const payload: PersistedProject = {
        v: SCHEMA_VERSION,
        positions: s.positions,
        timelineItems: s.timelineItems,
        duration: s.duration,
      };
      try {
        const next = JSON.stringify(payload);
        if (next === lastSerialized) return;
        lastSerialized = next;
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* quota exceeded / private mode — ignore */
      }
    };

    const schedule = () => {
      if (timer !== null) return;
      timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    };

    const unsub = useProjectStore.subscribe((state, prev) => {
      if (
        state.positions !== prev.positions ||
        state.timelineItems !== prev.timelineItems ||
        state.duration !== prev.duration
      ) {
        schedule();
      }
    });

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsub();
      // Final flush so a fast unmount (route change) still saves.
      flush();
    };
  }, []);

  return { hydrated: hydratedRef.current, restored: restoredRef.current };
}

export function clearPersistedProject(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
