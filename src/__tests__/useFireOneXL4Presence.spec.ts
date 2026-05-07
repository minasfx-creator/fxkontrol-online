/**
 * Unit: useFireOneXL4Presence — combines aggregator + adapter handshake +
 * provenance verification into a single honest presence signal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const controllersMock = vi.hoisted(() => ({
  list: [] as Array<{ profile: { kind: string }; device?: unknown }>,
}));
vi.mock('@/hooks/useActiveControllers', () => ({
  useActiveControllers: () => ({
    controllers: controllersMock.list,
    pending: [],
    acknowledge: () => {},
    close: () => {},
  }),
}));

import { useFireOneXL4Presence } from '@/hooks/useFireOneXL4Presence';
import { fireOneXL4Adapter } from '@/core/hardware/adapters/FireOneXL4Adapter';

describe('useFireOneXL4Presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    controllersMock.list = [];
    fireOneXL4Adapter.reset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    fireOneXL4Adapter.reset();
  });

  it('reports no-device when aggregator is empty', () => {
    const { result } = renderHook(() => useFireOneXL4Presence(50));
    expect(result.current.deviceOnline).toBe(false);
    expect(result.current.adapterConnected).toBe(false);
    expect(result.current.provenanceVerified).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('no-device');
    expect(result.current.firmware).toBeNull();
    expect(result.current.moduleAddress).toBeNull();
    expect(result.current.baudRate).toBeNull();
  });

  it('device-only when aggregator sees fireone but adapter has no handshake', () => {
    controllersMock.list = [{ profile: { kind: 'fireone' } }];
    const { result } = renderHook(() => useFireOneXL4Presence(50));
    expect(result.current.deviceOnline).toBe(true);
    expect(result.current.adapterConnected).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('device-only');
  });

  it('present once aggregator + adapter handshake + verified provenance align', async () => {
    controllersMock.list = [{ profile: { kind: 'fireone' } }];
    fireOneXL4Adapter.markHandshakeOk({
      transport: 'serial_usb',
      firmware: '5.00.08',
      moduleAddress: 3,
      baudRate: 9600,
    });

    const { result } = renderHook(() => useFireOneXL4Presence(50));
    await act(async () => { vi.advanceTimersByTime(80); });

    expect(result.current.deviceOnline).toBe(true);
    expect(result.current.adapterConnected).toBe(true);
    expect(result.current.provenanceVerified).toBe(true);
    expect(result.current.present).toBe(true);
    expect(result.current.reason).toBe('present');
    expect(result.current.firmware).toBe('5.00.08');
    expect(result.current.moduleAddress).toBe(3);
    expect(result.current.baudRate).toBe(9600);
  });

  it('drops to no-device when handshake is lost AND aggregator clears', async () => {
    controllersMock.list = [{ profile: { kind: 'fireone' } }];
    fireOneXL4Adapter.markHandshakeOk({ firmware: '5.00.08', moduleAddress: 1, baudRate: 9600 });

    const { result, rerender } = renderHook(() => useFireOneXL4Presence(50));
    await act(async () => { vi.advanceTimersByTime(80); });
    expect(result.current.present).toBe(true);

    controllersMock.list = [];
    fireOneXL4Adapter.markHandshakeLost();
    rerender();
    await act(async () => { vi.advanceTimersByTime(200); });
    rerender();

    expect(result.current.deviceOnline).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('no-device');
  });

  it('clears its polling timer on unmount (no leak)', () => {
    const spy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useFireOneXL4Presence(50));
    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
