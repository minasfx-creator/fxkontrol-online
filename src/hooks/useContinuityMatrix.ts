/**
 * ─── useContinuityMatrix — Canonical hook for 32-ch continuity ──────
 * Encapsulates polling, provenance discovery and the honest "no
 * reader → UNKNOWN" path. READ-ONLY surface — never imports
 * uiCommandGateway / fieldBus / executor / SafetyStateMachine.transition.
 *
 * Note: `runFullCheck()` does flow through `safetyStateMachine.setConditions`
 * inside the kernel service. That is the consolidated continuity ↔
 * SSM coupling and is NOT a state transition.
 */

import { useCallback, useEffect, useState } from 'react';
import { useInterval } from '@/hooks/useInterval';
import {
  continuityCheckService,
  type ContinuityReport,
  type PinResult,
} from '@/core/safety/ContinuityCheckService';
import {
  resolveContinuityReader,
  getReaderProvenance,
  type ContinuityReaderProvenance,
} from '@/core/safety/MuxContinuityReader';

export interface ContinuityMatrixState {
  pins: readonly PinResult[];
  report: ContinuityReport;
  provenance: ContinuityReaderProvenance;
  checking: boolean;
  isPassingForArm: boolean;
  /** Run a full 32-pin check using the live MUX reader when available. */
  runCheck: () => Promise<void>;
}

export function useContinuityMatrix(pollMs: number | null = 1000): ContinuityMatrixState {
  const [pins, setPins] = useState<readonly PinResult[]>(() => continuityCheckService.getAllPins());
  const [report, setReport] = useState<ContinuityReport>(() => continuityCheckService.getReport());
  const [provenance, setProvenance] = useState<ContinuityReaderProvenance>(() => getReaderProvenance());
  const [checking, setChecking] = useState(false);

  // Lightweight refresh — just snapshots the kernel state.
  useInterval(() => {
    setPins([...continuityCheckService.getAllPins()]);
    setReport(continuityCheckService.getReport());
    setProvenance(getReaderProvenance());
  }, pollMs);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const reader = resolveContinuityReader();
      // reader === null is intentional: service falls back to honest UNKNOWN.
      await continuityCheckService.runFullCheck(reader ?? undefined);
    } finally {
      setPins([...continuityCheckService.getAllPins()]);
      setReport(continuityCheckService.getReport());
      setProvenance(getReaderProvenance());
      setChecking(false);
    }
  }, []);

  // Refresh provenance once on mount (covers cases where adapter
  // promoted between page loads).
  useEffect(() => { setProvenance(getReaderProvenance()); }, []);

  return {
    pins,
    report,
    provenance,
    checking,
    isPassingForArm: continuityCheckService.isPassingForArm(),
    runCheck,
  };
}
