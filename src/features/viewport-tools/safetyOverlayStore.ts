/**
 * Safety Overlay Store — viewport-tools local UI state.
 * Controls visibility of safety/preview overlays. Pure presentation state,
 * NOT persisted to ShowPlan — overlays are visual aids only.
 */
import { create } from 'zustand';

interface SafetyOverlayState {
  pyroSafetyVisible: boolean;
  dronesCollisionVisible: boolean;
  dmxHeatmapVisible: boolean;
  togglePyroSafety: () => void;
  setPyroSafety: (v: boolean) => void;
  toggleDronesCollision: () => void;
  setDronesCollision: (v: boolean) => void;
  toggleDmxHeatmap: () => void;
  setDmxHeatmap: (v: boolean) => void;
}

export const useSafetyOverlayStore = create<SafetyOverlayState>((set) => ({
  pyroSafetyVisible: false,
  dronesCollisionVisible: false,
  dmxHeatmapVisible: false,
  togglePyroSafety: () => set((s) => ({ pyroSafetyVisible: !s.pyroSafetyVisible })),
  setPyroSafety: (v) => set({ pyroSafetyVisible: v }),
  toggleDronesCollision: () => set((s) => ({ dronesCollisionVisible: !s.dronesCollisionVisible })),
  setDronesCollision: (v) => set({ dronesCollisionVisible: v }),
  toggleDmxHeatmap: () => set((s) => ({ dmxHeatmapVisible: !s.dmxHeatmapVisible })),
  setDmxHeatmap: (v) => set({ dmxHeatmapVisible: v }),
}));
