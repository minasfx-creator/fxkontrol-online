import { describe, it, expect } from 'vitest';
import type { DiscoveryTransport } from '@/core/discovery/types';
import {
  PYRO_FIRE_PRIORITY,
  bannedFor,
  selectPyroTransports,
  verdictForPyroFire,
  explainPyroRefusal,
} from '../pyroTransportPolicy';

describe('pyroTransportPolicy', () => {
  it('canonical priority is webserial > webusb > artnet', () => {
    expect(PYRO_FIRE_PRIORITY).toEqual(['webserial', 'webusb', 'mdns-artnet']);
  });

  it('BLE allowed in design / simulation', () => {
    expect(bannedFor('pyro-fire', 'design')).toEqual([]);
    expect(bannedFor('pyro-fire', 'simulation')).toEqual([]);
  });

  it('BLE banned for pyro in real_operation', () => {
    expect(bannedFor('pyro-fire', 'real_operation')).toContain('webble');
    expect(bannedFor('pyro-arm', 'real_operation')).toContain('webble');
  });

  it('telemetry/dmx never banned', () => {
    expect(bannedFor('telemetry', 'real_operation')).toEqual([]);
    expect(bannedFor('dmx', 'real_operation')).toEqual([]);
  });

  it('selectPyroTransports orders allowed by priority', () => {
    const avail: DiscoveryTransport[] = ['mdns-artnet', 'webusb', 'webserial'];
    const sel = selectPyroTransports(avail, 'real_operation');
    expect(sel.allowed).toEqual(['webserial', 'webusb', 'mdns-artnet']);
    expect(sel.banned).toEqual([]);
    expect(sel.ok).toBe(true);
  });

  it('selectPyroTransports filters BLE in real_operation', () => {
    const avail: DiscoveryTransport[] = ['webble', 'webserial'];
    const sel = selectPyroTransports(avail, 'real_operation');
    expect(sel.allowed).toEqual(['webserial']);
    expect(sel.banned).toEqual(['webble']);
    expect(sel.ok).toBe(true);
  });

  it('selectPyroTransports keeps BLE in simulation', () => {
    const avail: DiscoveryTransport[] = ['webble', 'webserial'];
    const sel = selectPyroTransports(avail, 'simulation');
    expect(sel.allowed).toContain('webble');
    expect(sel.banned).toEqual([]);
  });

  it('verdict refuses BLE-only in real_operation', () => {
    const v = verdictForPyroFire(['webble'], 'real_operation');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('ble-banned-for-pyro');
  });

  it('verdict refuses empty available', () => {
    const v = verdictForPyroFire([], 'real_operation');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('no-allowed-transport');
  });

  it('verdict ok with serial available', () => {
    const v = verdictForPyroFire(['webserial', 'webble'], 'real_operation');
    expect(v.ok).toBe(true);
    expect(v.selection.allowed[0]).toBe('webserial');
  });

  it('explain returns operator-friendly text', () => {
    expect(explainPyroRefusal('ble-banned-for-pyro')).toMatch(/BLE/);
    expect(explainPyroRefusal('no-allowed-transport')).toMatch(/transporte/i);
  });
});
