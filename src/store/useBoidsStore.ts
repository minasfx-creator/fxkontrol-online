import { create } from 'zustand';
import { type BoidAgent, type BoidsConfig, DEFAULT_BOIDS_CONFIG } from '@/lib/boidsEngine';
import { type BoidsRecordingFrame } from '@/lib/exportEngine';

interface BoidsState {
  agents: BoidAgent[];
  config: BoidsConfig;
  running: boolean;
  seekTarget: boolean;
  recording: boolean;
  recordedFrames: BoidsRecordingFrame[];
  setAgents: (agents: BoidAgent[]) => void;
  setConfig: (updates: Partial<BoidsConfig>) => void;
  setRunning: (running: boolean) => void;
  setSeekTarget: (seek: boolean) => void;
  setRecording: (recording: boolean) => void;
  addRecordedFrame: (frame: BoidsRecordingFrame) => void;
  clearRecording: () => void;
}

export const useBoidsStore = create<BoidsState>((set) => ({
  agents: [],
  config: { ...DEFAULT_BOIDS_CONFIG },
  running: false,
  seekTarget: true,
  recording: false,
  recordedFrames: [],
  setAgents: (agents) => set({ agents }),
  setConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),
  setRunning: (running) => set({ running }),
  setSeekTarget: (seek) => set({ seekTarget: seek }),
  setRecording: (recording) => set({ recording }),
  addRecordedFrame: (frame) => set((s) => ({ recordedFrames: [...s.recordedFrames, frame] })),
  clearRecording: () => set({ recordedFrames: [] }),
}));
