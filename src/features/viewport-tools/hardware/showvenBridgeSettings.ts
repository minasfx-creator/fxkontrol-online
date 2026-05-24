/**
 * Showven Bridge Settings — per-project persisted preferences
 * ────────────────────────────────────────────────────────────
 * Stores the bridge's tunables (coalesce window, default cue duration)
 * keyed by `projectId` so each show carries its own dispatch profile.
 *
 * Persistence: localStorage via zustand/persist. Single shared map
 * across the whole app — `useShowvenBridgeSettings(projectId)` hook
 * returns the live values + setters.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShowvenBridgeProfile {
  /** Cue pulse width (ms). Showven slaves accept 1..65535. */
  defaultDurationMs: number;
  /** Coalesce same-device cues within this window (ms). 0 = disabled. */
  coalesceWindowMs: number;
}

export const SHOWVEN_BRIDGE_DEFAULTS: ShowvenBridgeProfile = {
  defaultDurationMs: 500,
  coalesceWindowMs: 8,
};

export const SHOWVEN_BRIDGE_LIMITS = {
  defaultDurationMs: { min: 10, max: 5000 },
  coalesceWindowMs:  { min: 0,  max: 250 },
} as const;

type ProfileMap = Record<string, ShowvenBridgeProfile>;

interface State {
  profiles: ProfileMap;
  setProfile: (projectId: string, patch: Partial<ShowvenBridgeProfile>) => void;
  reset: (projectId: string) => void;
}

const GLOBAL_KEY = '__global__';

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

export const useShowvenBridgeStore = create<State>()(
  persist(
    (set, get) => ({
      profiles: {},
      setProfile: (projectId, patch) => {
        const key = projectId || GLOBAL_KEY;
        const prev = get().profiles[key] ?? SHOWVEN_BRIDGE_DEFAULTS;
        const next: ShowvenBridgeProfile = {
          defaultDurationMs: clamp(
            patch.defaultDurationMs ?? prev.defaultDurationMs,
            SHOWVEN_BRIDGE_LIMITS.defaultDurationMs.min,
            SHOWVEN_BRIDGE_LIMITS.defaultDurationMs.max,
          ),
          coalesceWindowMs: clamp(
            patch.coalesceWindowMs ?? prev.coalesceWindowMs,
            SHOWVEN_BRIDGE_LIMITS.coalesceWindowMs.min,
            SHOWVEN_BRIDGE_LIMITS.coalesceWindowMs.max,
          ),
        };
        set({ profiles: { ...get().profiles, [key]: next } });
      },
      reset: (projectId) => {
        const key = projectId || GLOBAL_KEY;
        const { [key]: _, ...rest } = get().profiles;
        set({ profiles: rest });
      },
    }),
    {
      name: 'fxk-showven-bridge-settings-v1',
      version: 1,
      partialize: (s) => ({ profiles: s.profiles }),
    },
  ),
);

/** Resolve the active profile for a project, falling back to defaults. */
export function getShowvenBridgeProfile(projectId: string | null | undefined): ShowvenBridgeProfile {
  const key = projectId || GLOBAL_KEY;
  return useShowvenBridgeStore.getState().profiles[key] ?? SHOWVEN_BRIDGE_DEFAULTS;
}
