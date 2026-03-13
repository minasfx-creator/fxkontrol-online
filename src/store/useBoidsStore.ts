import { create } from 'zustand';
import { type BoidAgent, type BoidsConfig, DEFAULT_BOIDS_CONFIG } from '@/lib/boidsEngine';

interface BoidsState {
  agents: BoidAgent[];
  config: BoidsConfig;
  running: boolean;
  seekTarget: boolean;
  setAgents: (agents: BoidAgent[]) => void;
  setConfig: (updates: Partial<BoidsConfig>) => void;
  setRunning: (running: boolean) => void;
  setSeekTarget: (seek: boolean) => void;
}

export const useBoidsStore = create<BoidsState>((set) => ({
  agents: [],
  config: { ...DEFAULT_BOIDS_CONFIG },
  running: false,
  seekTarget: true,
  setAgents: (agents) => set({ agents }),
  setConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),
  setRunning: (running) => set({ running }),
  setSeekTarget: (seek) => set({ seekTarget: seek }),
}));
