import { create } from 'zustand';
import {
  type SMPTESyncState,
  type SMPTEFrameRate,
  DEFAULT_SYNC_STATE,
  updateSyncState,
} from '@/lib/smpteEngine';

interface SMPTEStoreState extends SMPTESyncState {
  setMode: (mode: 'master' | 'slave' | 'freerun') => void;
  setFrameRate: (fps: SMPTEFrameRate) => void;
  setRunning: (running: boolean) => void;
  tick: (currentTimeSeconds: number, externalTimeSeconds?: number) => void;
  reset: () => void;
}

export const useSMPTEStore = create<SMPTEStoreState>((set, get) => ({
  ...DEFAULT_SYNC_STATE,

  setMode: (mode) => set({ mode }),
  setFrameRate: (fps) => set({ frameRate: fps, timecode: { ...get().timecode, frameRate: fps } }),
  setRunning: (running) => set({ running }),

  tick: (currentTimeSeconds, externalTimeSeconds) => {
    const state = get();
    const updated = updateSyncState(state, currentTimeSeconds, externalTimeSeconds);
    set(updated);
  },

  reset: () => set({ ...DEFAULT_SYNC_STATE }),
}));
