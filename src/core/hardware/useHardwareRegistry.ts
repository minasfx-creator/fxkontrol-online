/**
 * ─── useHardwareRegistry — Reactive Hardware Store ─────────────────
 * Zustand store wrapping UnifiedHardwareRegistry for React consumption.
 * Provides reactive device list, snapshots, health, and readiness.
 */

import { create } from 'zustand';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { readinessEvaluator } from './ReadinessEvaluator';
import { deviceEventLog } from './DeviceEventLog';
import { loadHardwareTestData, type TestScenario } from './testData';
import type { HardwareDevice, HardwareStatusSnapshot, ReadinessResult, DeviceEvent } from './types';

interface HardwareRegistryState {
  devices: HardwareDevice[];
  snapshots: HardwareStatusSnapshot[];
  health: { online: number; total: number; warnings: number; errors: number; score: number };
  readiness: ReadinessResult | null;
  events: DeviceEvent[];
  isPolling: boolean;
  
  refresh: () => void;
  evaluateReadiness: () => void;
  loadTestScenario: (scenario: TestScenario) => void;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useHardwareRegistry = create<HardwareRegistryState>((set, get) => ({
  devices: [],
  snapshots: [],
  health: { online: 0, total: 0, warnings: 0, errors: 0, score: 0 },
  readiness: null,
  events: [],
  isPolling: false,

  refresh: () => {
    set({
      devices: unifiedHardwareRegistry.getDevices(),
      snapshots: unifiedHardwareRegistry.getSnapshots(),
      health: unifiedHardwareRegistry.getSystemHealth(),
      events: deviceEventLog.getRecent(50),
    });
  },

  evaluateReadiness: () => {
    const readiness = readinessEvaluator.evaluate();
    set({ readiness });
  },

  loadTestScenario: (scenario: TestScenario) => {
    loadHardwareTestData(scenario);
    unifiedHardwareRegistry.pollAll();
    const state = get();
    state.refresh();
    state.evaluateReadiness();
  },

  startPolling: () => {
    unifiedHardwareRegistry.startPolling(1000);
    set({ isPolling: true });
    // Auto-refresh on polls
    const unsub = unifiedHardwareRegistry.onChange(() => get().refresh());
    // Store unsub — would need cleanup in real app
  },

  stopPolling: () => {
    unifiedHardwareRegistry.stopPolling();
    set({ isPolling: false });
  },
}));
