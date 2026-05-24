/**
 * ─── Verification Store — Reactive Status (UNIFIED) ─────────────────
 * Single canonical store wrapping VerificationEngine.
 *
 * Replaces the previous duplicate `useVerificationEngine` hook — both
 * had the same responsibility, just different names. This is the merged
 * survivor and exposes the richer engine result shape (`issues` + `summary`).
 */

import { create } from 'zustand';
import { verificationEngine } from './VerificationEngine';
import type { VerificationResult, VerificationStatus } from './types';

interface VerificationState {
  result: VerificationResult | null;
  level: VerificationStatus;
  isRunning: boolean;
  lastRunAt: number;
  runVerification: () => void;
}

export const useVerificationStore = create<VerificationState>((set) => ({
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
