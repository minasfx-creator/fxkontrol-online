import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock SerialTransport to avoid touching real Web Serial.
const sentBauds: number[] = [];
vi.mock('@/lib/fireoneTransport', () => {
  class FakeSerialTransport {
    id: string; baud: number;
    private stateCb: any; private rxCb: any;
    constructor(id?: string, baud = 9600) {
      this.id = id ?? 'fake'; this.baud = baud; sentBauds.push(baud);
    }
    onStateChange(cb: any) { this.stateCb = cb; }
    onReceive(cb: any) { this.rxCb = cb; }
    async connect() { this.stateCb?.(this.id, 'connected'); }
    async disconnect() { this.stateCb?.(this.id, 'disconnected'); }
    async send(_b: Uint8Array) { /* noop */ }
  }
  return { SerialTransport: FakeSerialTransport };
});

vi.mock('@/core/discovery/controllerRegistry', () => ({
  markDeviceClassified: vi.fn(),
}));
vi.mock('@/core/safety/safetyBlackBox', () => ({
  recordSafetyNote: vi.fn(),
}));
vi.mock('@/core/command/uiCommandGateway', () => ({
  uiCommandGateway: {
    arm: vi.fn(), disarm: vi.fn(), eStop: vi.fn(),
    fire: vi.fn(), continuityCheck: vi.fn(),
  },
}));

const cableCalls: any[] = [];
const radioCalls: any[] = [];
vi.mock('@/core/network/realTransports', () => ({
  registerCableLink: (l: any) => cableCalls.push(l),
  registerRadioLink: (l: any) => radioCalls.push(l),
}));
vi.mock('@/core/network/fieldBus', () => ({
  fieldBus: { heartbeat: vi.fn() },
}));

import { renderHook, act } from '@testing-library/react';
import { useFireOneFleet } from '../useFireOneFleet';

describe('useFireOneFleet — mode toggle', () => {
  beforeEach(() => {
    sentBauds.length = 0;
    cableCalls.length = 0;
    radioCalls.length = 0;
    localStorage.clear();
  });

  it('persists mode in localStorage and exposes it on state', () => {
    const { result } = renderHook(() => useFireOneFleet());
    act(() => result.current.setMode('wireless'));
    expect(result.current.state.mode).toBe('wireless');
    expect(localStorage.getItem('fxk.fireone.linkMode.v1')).toBe('wireless');
  });

  it('opens 38400 baud transport when mode=wireless and connect()', async () => {
    const { result } = renderHook(() => useFireOneFleet());
    act(() => result.current.setMode('wireless'));
    await act(async () => { await result.current.connect(); });
    expect(sentBauds).toContain(38400);
    expect(sentBauds).not.toContain(9600);
    // radio link registered, cable link not
    expect(radioCalls.some(l => l && typeof l.send === 'function')).toBe(true);
    expect(cableCalls.some(l => l && typeof l.send === 'function')).toBe(false);
  });

  it('opens 9600 baud transport when mode=cable and connect()', async () => {
    const { result } = renderHook(() => useFireOneFleet());
    act(() => result.current.setMode('cable'));
    await act(async () => { await result.current.connect(); });
    expect(sentBauds).toContain(9600);
    expect(sentBauds).not.toContain(38400);
  });

  it('disconnect() revokes both cable and radio links', async () => {
    const { result } = renderHook(() => useFireOneFleet());
    act(() => result.current.setMode('cable'));
    await act(async () => { await result.current.connect(); });
    cableCalls.length = 0; radioCalls.length = 0;
    await act(async () => { await result.current.disconnect(); });
    // Both should be revoked (called with null)
    expect(cableCalls).toContain(null);
    expect(radioCalls).toContain(null);
  });
});
