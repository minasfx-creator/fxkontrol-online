/**
 * End-to-end integration test for `discoveryRegistryBridge`.
 *
 * Validates Phase 0 exit criterion: a single verified FXK16 handshake
 * promotes the entire piggy-back cluster (FXK16 + Battery-12V + Mux + SR)
 * to live_read_only, and `pendingRequiredAdapters` becomes empty.
 *
 * Mocks the three discovery sources so the test runs without real hardware.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';

// Capture listeners from each source so we can fire synthetic events.
const fxkListeners = new Set<(s: BridgeStatus) => void>();
const artnetListeners = new Set<(e: unknown) => void>();
const serialListeners = new Set<(e: unknown) => void>();

vi.mock('@/hooks/useFXK16Bridge', () => ({
  subscribeFXK16Bridge: (fn: (s: BridgeStatus) => void) => {
    fxkListeners.add(fn);
    return () => fxkListeners.delete(fn);
  },
}));

vi.mock('@/core/discovery/MdnsArtnetDiscoverer', () => ({
  mdnsArtnetDiscoverer: {
    watch: (fn: (e: unknown) => void) => {
      artnetListeners.add(fn);
      return () => artnetListeners.delete(fn);
    },
  },
}));

vi.mock('@/core/discovery/WebSerialDiscoverer', () => ({
  webSerialDiscoverer: {
    watch: (fn: (e: unknown) => void) => {
      serialListeners.add(fn);
      return () => serialListeners.delete(fn);
    },
  },
}));

// Avoid touching real polling timers.
vi.mock('@/core/hardware/UnifiedHardwareRegistry', async () => {
  const actual = await vi.importActual<typeof import('@/core/hardware/UnifiedHardwareRegistry')>(
    '@/core/hardware/UnifiedHardwareRegistry',
  );
  // Patch startPolling to no-op for the duration of the test.
  return {
    ...actual,
    unifiedHardwareRegistry: new Proxy(actual.unifiedHardwareRegistry, {
      get(target, prop, receiver) {
        if (prop === 'startPolling') return () => {};
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import {
  startDiscoveryRegistryBridge,
  stopDiscoveryRegistryBridge,
} from '../discoveryRegistryBridge';
import { fxk16ModuleAdapter } from '../adapters/FXK16ModuleAdapter';
import { batteryMonitorAdapter } from '../adapters/BatteryMonitorAdapter';
import { muxReaderAdapter } from '../adapters/MuxReaderAdapterCD4051';
import { shiftRegisterAdapter } from '../adapters/ShiftRegisterAdapter74HC595';
import { unifiedHardwareRegistry } from '../UnifiedHardwareRegistry';
import { pendingRequiredAdapters } from '../adapterTriage';

function verifiedStatus(): BridgeStatus {
  return {
    connected: true,
    deviceModel: 'FXK16',
    channelCount: 16,
    transport: 'usb',
    linkHealth: 'healthy',
  } as BridgeStatus;
}

function lostStatus(): BridgeStatus {
  return {
    connected: false,
    deviceModel: undefined,
    channelCount: 0,
    transport: undefined,
    linkHealth: 'lost',
  } as BridgeStatus;
}

describe('discoveryRegistryBridge · integration · Phase 0 exit criterion', () => {
  beforeEach(() => {
    fxkListeners.clear();
    artnetListeners.clear();
    serialListeners.clear();
    fxk16ModuleAdapter.reset();
    batteryMonitorAdapter.reset();
    muxReaderAdapter.reset();
    shiftRegisterAdapter.reset();
    startDiscoveryRegistryBridge();
  });
  afterEach(() => {
    stopDiscoveryRegistryBridge();
  });

  it('starts with all required adapters pending', () => {
    const pending = pendingRequiredAdapters(unifiedHardwareRegistry);
    const ids = pending.map((p) => p.id).sort();
    expect(ids).toEqual(['battery-12v', 'fxk16-esp32s3']);
  });

  it('a single verified FXK16 handshake promotes the whole piggy-back cluster', () => {
    fxkListeners.forEach((fn) => fn(verifiedStatus()));

    expect(fxk16ModuleAdapter.getProvenance().integration_mode).toBe('live_read_only');
    expect(batteryMonitorAdapter.getProvenance().integration_mode).toBe('live_read_only');
    expect(muxReaderAdapter.getProvenance().integration_mode).toBe('live_read_only');
    expect(shiftRegisterAdapter.getProvenance().integration_mode).toBe('live_read_only');

    // Phase 0 hardware exit criterion met.
    expect(pendingRequiredAdapters(unifiedHardwareRegistry)).toEqual([]);
  });

  it('losing the FXK16 link demotes the entire cluster atomically', () => {
    fxkListeners.forEach((fn) => fn(verifiedStatus()));
    fxkListeners.forEach((fn) => fn(lostStatus()));

    expect(fxk16ModuleAdapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(batteryMonitorAdapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(muxReaderAdapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(shiftRegisterAdapter.getProvenance().integration_mode).toBe('not_integrated');

    // Required adapters back to pending.
    expect(pendingRequiredAdapters(unifiedHardwareRegistry).length).toBeGreaterThan(0);
  });

  it('startDiscoveryRegistryBridge() is idempotent (single subscription)', () => {
    const before = fxkListeners.size;
    startDiscoveryRegistryBridge();
    startDiscoveryRegistryBridge();
    expect(fxkListeners.size).toBe(before);
  });
});
