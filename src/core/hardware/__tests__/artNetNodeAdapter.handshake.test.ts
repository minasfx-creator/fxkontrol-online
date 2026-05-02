/**
 * Tests for ArtNetNodeAdapter handshake promotion API.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArtNetNodeAdapter } from '../adapters/ArtNetNodeAdapter';

describe('ArtNetNodeAdapter — handshake promotion', () => {
  let adapter: ArtNetNodeAdapter;
  beforeEach(() => { adapter = new ArtNetNodeAdapter(); });

  it('starts disconnected and not_integrated with placeholder ip', () => {
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(adapter.getState().node_ip).toBe('0.0.0.0');
  });

  it('promotes to live_read_only with real host on markHandshakeOk', () => {
    adapter.markHandshakeOk('192.168.1.42');
    expect(adapter.getConnectionState()).toBe('connected');
    const prov = adapter.getProvenance();
    expect(prov.integration_mode).toBe('live_read_only');
    expect(prov.transport_type).toBe('ethernet_udp');
    expect(adapter.getState().node_ip).toBe('192.168.1.42');
    expect(adapter.getState().link.connected).toBe(true);
  });

  it('demotes back to not_integrated on markHandshakeLost', () => {
    adapter.markHandshakeOk('10.0.0.7');
    adapter.markHandshakeLost();
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
    expect(adapter.getState().link.connected).toBe(false);
  });

  it('reset() also demotes provenance', () => {
    adapter.markHandshakeOk('10.0.0.7');
    adapter.reset();
    expect(adapter.getProvenance().integration_mode).toBe('not_integrated');
  });
});
