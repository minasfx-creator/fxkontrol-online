/**
 * Tests for DMXUniverseAdapter handshake promotion API.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dmxUniverseAdapter } from '../adapters/DMXUniverseAdapter';

describe('DMXUniverseAdapter — handshake promotion', () => {
  beforeEach(() => { dmxUniverseAdapter.reset(); });

  it('starts disconnected and not_integrated with link.connected=false', () => {
    expect(dmxUniverseAdapter.getConnectionState()).toBe('disconnected');
    expect(dmxUniverseAdapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(dmxUniverseAdapter.getState().link.connected).toBe(false);
  });

  it('promotes to live_read_only on markHandshakeOk', () => {
    dmxUniverseAdapter.markHandshakeOk('Enttec DMX USB Pro');
    expect(dmxUniverseAdapter.getConnectionState()).toBe('connected');
    const prov = dmxUniverseAdapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe('serial_usb');
    expect(dmxUniverseAdapter.getState().link.connected).toBe(true);
    expect(dmxUniverseAdapter.getState().protocol).toBe('DMX512');
  });

  it('demotes back to not_integrated on markHandshakeLost', () => {
    dmxUniverseAdapter.markHandshakeOk('USBDMX');
    dmxUniverseAdapter.markHandshakeLost();
    expect(dmxUniverseAdapter.getConnectionState()).toBe('disconnected');
    expect(dmxUniverseAdapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(dmxUniverseAdapter.getState().link.connected).toBe(false);
  });

  it('reset() also demotes provenance', () => {
    dmxUniverseAdapter.markHandshakeOk('uDMX');
    dmxUniverseAdapter.reset();
    expect(dmxUniverseAdapter.getProvenance().integration_mode).toBe('not_integrated');
  });
});
