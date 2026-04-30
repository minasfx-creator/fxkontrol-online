/**
 * Safety Overlay Store — viewport-tools local UI state.
 * Controls visibility of PYRO safety zones (geofence + ballistic preview)
 * and (future) other segment overlays. Pure presentation state, NOT
 * persisted to ShowPlan — overlays are visual aids only.
 */
import { create } from 'zustand';

interface SafetyOverlayState {
  pyroSafetyVisible: boolean;
  togglePyroSafety: () => void;
  setPyroSafety: (v: boolean) => void;
}

export const useSafetyOverlayStore = create<SafetyOverlayState>((set) => ({
  pyroSafetyVisible: false,
  togglePyroSafety: () => set((s) => ({ pyroSafetyVisible: !s.pyroSafetyVisible })),
  setPyroSafety: (v) => set({ pyroSafetyVisible: v }),
}));
