/**
 * ─── useVerificationEngine — Reactive Verification Store ────────────
 * Zustand store wrapping the centralized VerificationEngine.
 * Drop-in replacement for useVerificationStore with richer types.
 */

import { create } from 'zustand';
import { verificationEngine } from './VerificationEngine';
import type { VerificationResult, VerificationStatus } from './types';

interface VerificationEngineState {
  result: VerificationResult | null;
  level: VerificationStatus;
  isRunning: boolean;
  lastRunAt: number;
  runVerification: () => void;
}

export const useVerificationEngine = create<VerificationEngineState>((set) => ({
  result: null,
  level: 'BLOCKED',
  isRunning: false,
  lastRunAt: 0,

  runVerification: () => {
    set({ isRunning: true });
    try {
      const result = verificationEngine.run();
      set({
        result,
        level: result.level,
        isRunning: false,
        lastRunAt: result.timestamp,
      });
    } catch {
      set({ isRunning: false });
    }
  },
}));
