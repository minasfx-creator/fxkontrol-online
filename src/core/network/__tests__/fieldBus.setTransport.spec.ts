import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fieldBus } from '@/core/network/fieldBus';

describe('FieldBus.setTransport (real wiring)', () => {
  beforeEach(() => {
    // revoke to stub so each test starts honest
    const stub = { send: () => false, isAlive: () => false };
    fieldBus.setTransport('wifi', stub);
    fieldBus.setTransport('rs485', stub);
    fieldBus.setTransport('relay', stub);
  });

  it('stub transports refuse to send (honest hardware)', () => {
    expect(fieldBus.send({ type: 'pyro', payload: { module: 1, channel: 0 } })).toBe(false);
    expect(fieldBus.isAlive()).toBe(false);
  });

  it('setTransport replaces stub and sends bytes', () => {
    const sent: any[] = [];
    fieldBus.setTransport('wifi', {
      isAlive: () => true,
      send: (msg) => { sent.push(msg); return true; },
    });
    fieldBus.heartbeat('wifi');
    const ok = fieldBus.send({ type: 'dmx', payload: { universe: 1, bytes: new Uint8Array([1, 2]) } });
    expect(ok).toBe(true);
    expect(sent.length).toBe(1);
  });

  it('revoking via stub disables sending without faking alive', () => {
    // wifi is the default active transport (idx 0)
    fieldBus.setTransport('wifi', { isAlive: () => true, send: () => true });
    fieldBus.heartbeat('wifi');
    expect(fieldBus.send({ type: 'pyro', payload: {} })).toBe(true);
    fieldBus.setTransport('wifi', { isAlive: () => false, send: () => false });
    expect(fieldBus.send({ type: 'pyro', payload: {} })).toBe(false);
  });
});
