/**
 * useTerrainPersistenceMode — Zustand store for the user-selectable terrain
 * cache persistence mode.
 *
 * Persisted in localStorage so the operator's choice survives reloads even
 * when the chosen mode itself is 'session' or 'none' (the *preference* is
 * remembered; the cached *data* follows the chosen mode).
 *
 * Modes:
 *  - 'project' : durable per-project cache in IndexedDB. Default.
 *  - 'session' : sessionStorage; clears on tab close. Useful for QA passes.
 *  - 'none'    : in-memory only. No browser persistence; cloud hydrate still
 *                works if enabled.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LocalCacheMode } from './terrainCacheLocalStorage';

interface TerrainPersistenceModeStore {
  mode: LocalCacheMode;
  setMode: (m: LocalCacheMode) => void;
}

export const useTerrainPersistenceMode = create<TerrainPersistenceModeStore>()(
  persist(
    (set) => ({
      mode: 'project',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'fxk:terrain:persistence-mode',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const TERRAIN_MODE_DESCRIPTIONS: Record<LocalCacheMode, { label: string; help: string }> = {
  project: { label: 'Per Project', help: 'IndexedDB; survives reloads + tab close. Best for daily use.' },
  session: { label: 'Session',     help: 'sessionStorage; survives reloads but clears on tab close.' },
  none:    { label: 'Memory Only', help: 'No browser persistence. Cloud hydrate (if any) still works.' },
};
