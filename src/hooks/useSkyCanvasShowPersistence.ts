/**
 * useSkyCanvasShowPersistence — autosave of cues + duration + audio name
 * to localStorage (key fxk.skycanvas.show.v1). Pure UI state — never touches
 * CommandBus, FieldBus, SafetyStateMachine, or workMode.
 *
 * Hydration is one-shot on mount (idempotent). Save is debounced 500ms and
 * quota-safe. Playback (currentTime/isPlaying) and audio buffer are NOT
 * persisted — only the catalog of cues + scene length + audio file name.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useProjectStore } from '@/store/useProjectStore';
import type { CueMarker } from '@/types/projectTypes';

const STORAGE_KEY = 'fxk.skycanvas.show.v1';
const MAX_BYTES = 32 * 1024;
const DEBOUNCE_MS = 500;

interface PersistedShow {
  v: 1;
  duration: number;
  audioName: string | null;
  cues: CueMarker[];
  savedAt: string;
}

function readLS(): PersistedShow | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedShow;
    if (parsed?.v !== 1 || !Array.isArray(parsed.cues)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLS(payload: PersistedShow): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const json = JSON.stringify(payload);
    if (json.length > MAX_BYTES) return false;
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedSkyCanvasShow(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export interface UseSkyCanvasShowPersistenceOptions {
  /** Current audio file name (display only — buffer is not stored). */
  audioName: string | null;
  /** Optional notice on first save of the session. */
  notifyFirstSave?: boolean;
}

export function useSkyCanvasShowPersistence({
  audioName,
  notifyFirstSave = true,
}: UseSkyCanvasShowPersistenceOptions): void {
  const hydratedRef = useRef(false);
  const firstSaveDoneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate once on mount ──
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const snap = readLS();
    if (!snap) return;
    const s = useProjectStore.getState();
    if (snap.duration > 0 && s.duration !== snap.duration) {
      s.setDuration(snap.duration);
    }
    if (snap.cues.length > 0 && s.cueMarkers.length === 0) {
      s.clearCueMarkers();
      for (const c of snap.cues) s.addCueMarker(c);
    }
  }, []);

  // ── Debounced save on cue/duration change ──
  const cueMarkers = useProjectStore((s) => s.cueMarkers);
  const duration = useProjectStore((s) => s.duration);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const ok = writeLS({
        v: 1,
        duration,
        audioName,
        cues: cueMarkers,
        savedAt: new Date().toISOString(),
      });
      if (ok && notifyFirstSave && !firstSaveDoneRef.current) {
        firstSaveDoneRef.current = true;
        toast('Show salvo localmente', { duration: 1800 });
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [cueMarkers, duration, audioName, notifyFirstSave]);
}
