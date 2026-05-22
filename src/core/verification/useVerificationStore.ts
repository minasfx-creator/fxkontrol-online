/**
 * ─── Verification Store — Reactive Status ───────────────────────────
 * Zustand store exposing real-time verification state for UI consumption.
 */

import { create } from 'zustand';
import { verificationPass } from './VerificationPass';
import type { VerificationResult, VerificationLevel } from '@/core/showplan/ShowPlan';

interface VerificationState {
  result: VerificationResult | null;
  level: VerificationLevel;
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
      const result = verificationPass.run();
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
