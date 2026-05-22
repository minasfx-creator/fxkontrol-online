/**
 * useActiveVenue — minimal store holding the currently-applied venue preset
 * id. UI-only signal so the 3D overlay can render audience/exclusion/water
 * polygons and NFPA rings without coupling to safety state.
 */
import { create } from 'zustand';

interface ActiveVenueState {
  activeVenuePresetId: string | null;
  setActiveVenuePreset: (id: string | null) => void;
}

export const useActiveVenue = create<ActiveVenueState>((set) => ({
  activeVenuePresetId: null,
  setActiveVenuePreset: (id) => set({ activeVenuePresetId: id }),
}));
