/**
 * ─── Diagnostics Thresholds Store ───────────────────────────────────
 * Limites configuráveis usados pelas validações em /diagnostics/dmx-pyro.
 * Persiste em localStorage para sobreviver reloads.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DiagnosticsThresholds {
  /** Aviso quando há ≥ N canais livres entre dois fixtures contíguos. */
  addressGap: number;
  /** Aviso quando ≥ N universes consecutivos não são usados entre dois universes em uso. */
  universeGap: number;
  /** Aviso quando ocupação do universe ≥ N% (0–100). */
  universeCapPct: number;
  /** Mostrar aviso quando primeiro universe usado é > este valor. */
  universeStartHint: number;
}

export const DEFAULT_THRESHOLDS: DiagnosticsThresholds = {
  addressGap: 32,
  universeGap: 1,
  universeCapPct: 90,
  universeStartHint: 1,
};

interface ThresholdsStore extends DiagnosticsThresholds {
  set: <K extends keyof DiagnosticsThresholds>(k: K, v: DiagnosticsThresholds[K]) => void;
  reset: () => void;
}

export const useDiagnosticsThresholds = create<ThresholdsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_THRESHOLDS,
      set: (k, v) => set({ [k]: v } as Partial<ThresholdsStore>),
      reset: () => set({ ...DEFAULT_THRESHOLDS }),
    }),
    { name: "fxk.diagnostics-thresholds.v1" },
  ),
);
