/**
 * Laser Preview Store — Real-time laser state for 3D viewport
 * Bridges LaserControlPanel ↔ SkyCanvas LaserPreviewBeams
 */
import { create } from 'zustand';

export interface LaserSource {
  id: string;
  position: [number, number, number];
  pan: number;        // degrees
  tilt: number;       // degrees
  intensity: number;  // 0-100
  color: string;      // hex
  pattern: string;    // fan, harp, tunnel, cone, single, wave, grid
  beamCount: number;
  scanRate: number;    // kpps
  divergence: number;  // mrad
  hazeLevel: number;   // 0-1
  hwPreset: string;
  enabled: boolean;
}

interface LaserPreviewState {
  sources: LaserSource[];
  globalEnabled: boolean;
  setGlobalEnabled: (enabled: boolean) => void;
  addSource: (source: LaserSource) => void;
  updateSource: (id: string, updates: Partial<Omit<LaserSource, 'id'>>) => void;
  removeSource: (id: string) => void;
  updateDefaultSource: (updates: Partial<Omit<LaserSource, 'id'>>) => void;
}

const DEFAULT_SOURCE: LaserSource = {
  id: 'default',
  position: [0, 0.5, 0],
  pan: 0,
  tilt: 45,
  intensity: 100,
  color: '#00FF00',
  pattern: 'fan',
  beamCount: 8,
  scanRate: 30,
  divergence: 1.2,
  hazeLevel: 0.4,
  hwPreset: 'none',
  enabled: true,
};

export const useLaserPreviewStore = create<LaserPreviewState>((set) => ({
  sources: [DEFAULT_SOURCE],
  globalEnabled: false,
  setGlobalEnabled: (enabled) => set({ globalEnabled: enabled }),
  addSource: (source) => set((s) => ({ sources: [...s.sources, source] })),
  updateSource: (id, updates) => set((s) => ({
    sources: s.sources.map((src) => src.id === id ? { ...src, ...updates } : src),
  })),
  removeSource: (id) => set((s) => ({
    sources: s.sources.filter((src) => src.id !== id),
  })),
  updateDefaultSource: (updates) => set((s) => ({
    sources: s.sources.map((src) => src.id === 'default' ? { ...src, ...updates } : src),
  })),
}));
