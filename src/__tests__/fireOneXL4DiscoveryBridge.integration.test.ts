/**
 * Integration: discoveryRegistryBridge ↔ FireOne XL4+ bridge ↔ adapter.
 *
 * Exercises the full command-flow that the wizard triggers in production:
 *   1. wizard calls notifyHandshakeOk → bridge singleton emits → discovery
 *      bridge listener promotes fireOneXL4Adapter to live_read_only.
 *   2. wizard calls notifyHandshakeLost (or hot-unplug) → adapter demotes
 *      back to not_integrated immediately.
 *   3. discoveryRegistryBridge subscription is idempotent — repeated
 *      publishes with same `verified` flag do not re-promote.
 *
 * Latency contract: every promotion is observable in the same tick (sync
 * subscriber), so the registry is honest within < 1 frame of the wizard.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  startDiscoveryRegistryBridge,
  stopDiscoveryRegistryBridge,
} from '@/core/hardware/discoveryRegistryBridge';
import { fireOneXL4Adapter } from '@/core/hardware/adapters/FireOneXL4Adapter';
import {
  notifyHandshakeOk,
  notifyHandshakeLost,
  _resetFireOneXL4BridgeForTests,
} from '@/hooks/useFireOneXL4Bridge';
import { isProvenanceVerified } from '@/core/hardware/provenance';

describe('FireOne XL4+ — discoveryRegistryBridge integration', () => {
  beforeEach(() => {
    _resetFireOneXL4BridgeForTests();
    fireOneXL4Adapter.reset();
    startDiscoveryRegistryBridge();
  });

  afterEach(() => {
    stopDiscoveryRegistryBridge();
    _resetFireOneXL4BridgeForTests();
    fireOneXL4Adapter.reset();
  });

  it('starts with adapter not_integrated (no synthetic promotion at boot)', () => {
    expect(fireOneXL4Adapter.getConnectionState()).toBe('disconnected');
    expect(isProvenanceVerified(fireOneXL4Adapter.getProvenance())).toBe(false);
  });

  it('wizard handshake → adapter promoted to live_read_only with metadata', () => {
    notifyHandshakeOk({
      firmware: '5.00.08',
      moduleAddress: 4,
      baudRate: 9600,
    });

    expect(fireOneXL4Adapter.getConnectionState()).toBe('connected');
    expect(fireOneXL4Adapter.getFirmware()).toBe('5.00.08');
    expect(fireOneXL4Adapter.getModuleAddress()).toBe(4);
    expect(fireOneXL4Adapter.getBaudRate()).toBe(9600);
    const prov = fireOneXL4Adapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe('serial_usb');
    expect(isProvenanceVerified(prov)).toBe(true);
  });

  it('hot-unplug / explicit lost → adapter demoted back to not_integrated', () => {
    notifyHandshakeOk({ firmware: '5.00.08', moduleAddress: 1, baudRate: 9600 });
    expect(fireOneXL4Adapter.getConnectionState()).toBe('connected');

    notifyHandshakeLost();
    expect(fireOneXL4Adapter.getConnectionState()).toBe('disconnected');
    expect(isProvenanceVerified(fireOneXL4Adapter.getProvenance())).toBe(false);
  });

  it('re-publish with same verified flag is idempotent (no spurious resets)', () => {
    notifyHandshakeOk({ firmware: '5.00.08', moduleAddress: 1, baudRate: 9600 });
    const prov1 = fireOneXL4Adapter.getProvenance();
    notifyHandshakeOk({ firmware: '5.00.08', moduleAddress: 1, baudRate: 9600 });
    const prov2 = fireOneXL4Adapter.getProvenance();
    expect(prov1.integration_mode).toBe(prov2.integration_mode);
    expect(fireOneXL4Adapter.getConnectionState()).toBe('connected');
  });

  it('stopDiscoveryRegistryBridge unwires the listener (no further promotions)', () => {
    stopDiscoveryRegistryBridge();
    notifyHandshakeOk({ firmware: '5.00.08', moduleAddress: 9, baudRate: 19200 });
    expect(fireOneXL4Adapter.getConnectionState()).toBe('disconnected');
  });
});
