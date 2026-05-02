/**
 * Tests for FXK16ModuleAdapter handshake promotion API.
 * Verifies that the adapter starts NOT_INTEGRATED, promotes to
 * LIVE READ-ONLY on `markHandshakeOk`, and demotes on `markHandshakeLost`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FXK16ModuleAdapter } from '../adapters/FXK16ModuleAdapter';

describe('FXK16ModuleAdapter — handshake promotion', () => {
  let adapter: FXK16ModuleAdapter;
  beforeEach(() => { adapter = new FXK16ModuleAdapter(); });

  it('starts disconnected and not_integrated', () => {
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('promotes to live_read_only on markHandshakeOk', () => {
    adapter.markHandshakeOk('serial_usb');
    expect(adapter.getConnectionState()).toBe('connected');
    const prov = adapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe('serial_usb');
    expect(prov.evidence_level).toBe('telemetry_verified');
  });

  it('respects BLE transport on promotion', () => {
    adapter.markHandshakeOk('ble');
    expect(adapter.getProvenance().transport_type).toBe('ble');
  });

  it('demotes back to not_integrated on markHandshakeLost', () => {
    adapter.markHandshakeOk('serial_usb');
    adapter.markHandshakeLost();
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('reset() also demotes provenance', () => {
    adapter.markHandshakeOk('serial_usb');
    adapter.reset();
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
  });
});
