import { describe, it, expect } from 'vitest';
import {
  selectBestPyroTransport,
  isTransportAllowed,
  PYRO_FIRE_PRIORITY,
  BANNED_FOR_REAL_FIRE,
} from '../pyroTransportPolicy';

describe('pyroTransportPolicy — routing', () => {
  it('two_wire wins over serial when both available', () => {
    const r = selectBestPyroTransport('fxk16', ['serial', 'two_wire', 'usb'], 'real_operation');
    expect(r).toBe('two_wire');
  });

  it('falls back through priority list', () => {
    const r = selectBestPyroTransport('fxk16', ['artnet', 'usb'], 'real_operation');
    expect(r).toBe('usb');
  });

  it('rejects ble in real_operation', () => {
    expect(isTransportAllowed('ble', 'real_operation')).toBe(false);
    const r = selectBestPyroTransport('fxk16', ['ble'], 'real_operation');
    expect(r).toBeNull();
  });

  it('allows ble in design/simulation (with warn)', () => {
    expect(isTransportAllowed('ble', 'design')).toBe(true);
    expect(isTransportAllowed('ble', 'simulation')).toBe(true);
  });

  it('priority list is stable: two_wire > serial > usb > artnet > radio', () => {
    expect(PYRO_FIRE_PRIORITY[0]).toBe('two_wire');
    expect(PYRO_FIRE_PRIORITY.indexOf('serial')).toBeLessThan(PYRO_FIRE_PRIORITY.indexOf('usb'));
    expect(PYRO_FIRE_PRIORITY.indexOf('usb')).toBeLessThan(PYRO_FIRE_PRIORITY.indexOf('artnet'));
  });

  it('BLE remains in BANNED_FOR_REAL_FIRE', () => {
    expect(BANNED_FOR_REAL_FIRE.has('ble')).toBe(true);
  });
});
