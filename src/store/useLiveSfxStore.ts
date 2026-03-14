import { create } from 'zustand';

export interface LiveSfxInstance {
  id: string;
  type: 'co2' | 'flame' | 'confetti' | 'streamer' | 'cryo' | 'haze' | 'spark' | 'custom';
  position: [number, number, number];
  color: string;
  intensity: number; // 0-255
  startedAt: number; // performance.now()
  duration: number;  // ms
}

interface LiveSfxState {
  activeEffects: LiveSfxInstance[];
  fireEffect: (effect: LiveSfxInstance) => void;
  stopEffect: (id: string) => void;
  clearAll: () => void;
}

export const useLiveSfxStore = create<LiveSfxState>((set) => ({
  activeEffects: [],
  fireEffect: (effect) => set((s) => ({
    activeEffects: [...s.activeEffects.filter(e => e.id !== effect.id), effect],
  })),
  stopEffect: (id) => set((s) => ({
    activeEffects: s.activeEffects.filter(e => e.id !== id),
  })),
  clearAll: () => set({ activeEffects: [] }),
}));
