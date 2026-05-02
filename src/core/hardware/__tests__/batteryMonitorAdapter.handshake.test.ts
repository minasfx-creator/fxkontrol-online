/**
 * Battery-12V piggy-back handshake test.
 * Battery telemetry rides on the FXK16 host link — promotion/demotion
 * must mirror the host. Read-only by construction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { batteryMonitorAdapter } from '../adapters/BatteryMonitorAdapter';

describe('BatteryMonitorAdapter · handshake (piggy-back FXK16)', () => {
  beforeEach(() => batteryMonitorAdapter.reset());

  it('starts disconnected with simulated provenance', () => {
    expect(batteryMonitorAdapter.getConnectionState()).toBe('disconnected');
    expect(batteryMonitorAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('promotes to live_read_only on markHandshakeOk', () => {
    batteryMonitorAdapter.markHandshakeOk('serial_usb');
    expect(batteryMonitorAdapter.getConnectionState()).toBe('connected');
    const prov = batteryMonitorAdapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport).toBe('serial_usb');
  });

  it('demotes back to not_integrated on markHandshakeLost', () => {
    batteryMonitorAdapter.markHandshakeOk('serial_usb');
    batteryMonitorAdapter.markHandshakeLost();
    expect(batteryMonitorAdapter.getConnectionState()).toBe('disconnected');
    expect(batteryMonitorAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });

  it('remains read-only — canWrite=false even after promotion', () => {
    batteryMonitorAdapter.markHandshakeOk('serial_usb');
    expect(batteryMonitorAdapter.getCapabilities().canWrite).toBe(false);
  });

  it('reset() also demotes provenance', () => {
    batteryMonitorAdapter.markHandshakeOk('ble');
    batteryMonitorAdapter.reset();
    expect(batteryMonitorAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });
});
