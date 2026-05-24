/**
 * ─── useHardwareRegistry — Reactive Hardware Store ─────────────────
 * Zustand store wrapping UnifiedHardwareRegistry for React consumption.
 * Provides reactive device list, snapshots, health, and readiness.
 *
 * NOTE: All test-scenario / fake-data loaders were removed for the
 * production cutover. Devices populate exclusively from real adapters
 * connected via WebSerial / WebUSB / Art-Net.
 */

import { create } from 'zustand';
import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { readinessEvaluator } from './ReadinessEvaluator';
import { deviceEventLog } from './DeviceEventLog';
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

  startPolling: () => {
    unifiedHardwareRegistry.startPolling(1000);
    set({ isPolling: true });
    unifiedHardwareRegistry.onChange(() => get().refresh());
  },

  stopPolling: () => {
    unifiedHardwareRegistry.stopPolling();
    set({ isPolling: false });
  },
}));
