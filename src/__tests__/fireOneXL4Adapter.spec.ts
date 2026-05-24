/**
 * Unit: FireOneXL4Adapter — verifies handshake promotion / demotion,
 * snapshot semantics, and that no synthetic data ever leaks (honest
 * hardware contract).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fireOneXL4Adapter } from '@/core/hardware/adapters/FireOneXL4Adapter';
import { isProvenanceVerified } from '@/core/hardware/provenance';

describe('FireOneXL4Adapter', () => {
  beforeEach(() => {
    fireOneXL4Adapter.reset();
  });

  it('starts disconnected with not_integrated provenance (zero synthetic)', () => {
    expect(fireOneXL4Adapter.getConnectionState()).toBe('disconnected');
    const prov = fireOneXL4Adapter.getProvenance();
    expect(prov.integration_mode).toBe('not_integrated');
    expect(isProvenanceVerified(prov)).toBe(false);
    const snap = fireOneXL4Adapter.getSnapshot();
    expect(snap.online).toBe(false);
    expect(snap.metrics.firmware).toBe('unknown');
    expect(snap.metrics.module_address).toBe(-1);
    expect(snap.metrics.baud).toBe(0);
  });

  it('exposes safety-locked capabilities (canWrite false, canSimulate gated by flag)', () => {
    const caps = fireOneXL4Adapter.getCapabilities();
    expect(caps.canRead).toBe(true);
    expect(caps.canWrite).toBe(false);
    // canSimulate=true matches FXK16/FXK32Q parity; pollTelemetry is
    // gated at runtime by isHardwareSimulatorEnabled() (default OFF).
    expect(caps.canSimulate).toBe(true);
    expect(caps.supportsTelemetry).toBe(true);
    expect(caps.supportsContinuity).toBe(true);
    expect(caps.maxChannels).toBe(32);
  });

  it('promotes to live_read_only after markHandshakeOk and reflects metadata', () => {
    fireOneXL4Adapter.markHandshakeOk({
      transport: 'serial_usb',
      firmware: '5.00.08',
      moduleAddress: 7,
      baudRate: 9600,
    });
    expect(fireOneXL4Adapter.getConnectionState()).toBe('connected');
    expect(fireOneXL4Adapter.getFirmware()).toBe('5.00.08');
    expect(fireOneXL4Adapter.getModuleAddress()).toBe(7);
    expect(fireOneXL4Adapter.getBaudRate()).toBe(9600);
    const prov = fireOneXL4Adapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe('serial_usb');
    expect(isProvenanceVerified(prov)).toBe(true);
    const snap = fireOneXL4Adapter.getSnapshot();
    expect(snap.online).toBe(true);
    expect(snap.warnings).toHaveLength(0);
    expect(snap.metrics.firmware).toBe('5.00.08');
    expect(snap.metrics.module_address).toBe(7);
    expect(snap.metrics.baud).toBe(9600);
  });

  it('markHandshakeLost demotes back to not_integrated immediately', () => {
    fireOneXL4Adapter.markHandshakeOk({ firmware: '5.00.08', moduleAddress: 1, baudRate: 9600 });
    fireOneXL4Adapter.markHandshakeLost();
    expect(fireOneXL4Adapter.getConnectionState()).toBe('disconnected');
    const prov = fireOneXL4Adapter.getProvenance();
    expect(prov.integration_mode).toBe('not_integrated');
    expect(isProvenanceVerified(prov)).toBe(false);
    expect(fireOneXL4Adapter.getSnapshot().online).toBe(false);
  });

  it('runDiagnostics flags missing firmware/connection when offline', () => {
    const d = fireOneXL4Adapter.runDiagnostics();
    expect(d.healthy).toBe(false);
    expect(d.issues.some((i) => /not connected/i.test(i))).toBe(true);
    expect(d.issues.some((i) => /firmware/i.test(i))).toBe(true);
  });

  it('pollTelemetry is a no-op (no synthetic data generation)', () => {
    const before = fireOneXL4Adapter.getSnapshot();
    fireOneXL4Adapter.pollTelemetry();
    const after = fireOneXL4Adapter.getSnapshot();
    expect(after.online).toBe(before.online);
    expect(after.metrics.firmware).toBe(before.metrics.firmware);
  });
});
