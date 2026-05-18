/**
 * Unit: useFXK32QPresence — combines aggregator + adapter handshake +
 * provenance verification into a single honest presence signal. Zero
 * mocks for hardware data; we drive the adapter through its public
 * `markHandshakeOk/Lost` and the controller list through a vi.mock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const controllersMock = vi.hoisted(() => ({ list: [] as Array<{ profile: { kind: string }; device?: unknown }> }));
vi.mock('@/hooks/useActiveControllers', () => ({
  useActiveControllers: () => ({
    controllers: controllersMock.list,
    pending: [],
    acknowledge: () => {},
    close: () => {},
  }),
}));

import { useFXK32QPresence } from '@/hooks/useFXK32QPresence';
import { fxk32qModuleAdapter } from '@/core/hardware/adapters/FXK32QModuleAdapter';

describe('useFXK32QPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    controllersMock.list = [];
    fxk32qModuleAdapter.reset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    fxk32qModuleAdapter.reset();
  });

  it('reports no-device when aggregator is empty', () => {
    const { result } = renderHook(() => useFXK32QPresence(50));
    expect(result.current.deviceOnline).toBe(false);
    expect(result.current.adapterConnected).toBe(false);
    expect(result.current.provenanceVerified).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('no-device');
  });

  it('device-only when aggregator sees fxk32q but adapter has no handshake', () => {
    controllersMock.list = [{ profile: { kind: 'fxk32q' } }];
    const { result } = renderHook(() => useFXK32QPresence(50));
    expect(result.current.deviceOnline).toBe(true);
    expect(result.current.adapterConnected).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('device-only');
  });

  it('present once aggregator + adapter handshake + verified provenance align', async () => {
    controllersMock.list = [{ profile: { kind: 'fxk32q' } }];
    fxk32qModuleAdapter.markHandshakeOk('serial_usb');

    const { result } = renderHook(() => useFXK32QPresence(50));
    await act(async () => { vi.advanceTimersByTime(80); });

    expect(result.current.deviceOnline).toBe(true);
    expect(result.current.adapterConnected).toBe(true);
    expect(result.current.provenanceVerified).toBe(true);
    expect(result.current.present).toBe(true);
    expect(result.current.reason).toBe('present');
  });

  it('drops to no-device when handshake is lost AND aggregator clears', async () => {
    controllersMock.list = [{ profile: { kind: 'fxk32q' } }];
    fxk32qModuleAdapter.markHandshakeOk('serial_usb');

    const { result, rerender } = renderHook(() => useFXK32QPresence(50));
    await act(async () => { vi.advanceTimersByTime(80); });
    expect(result.current.present).toBe(true);

    controllersMock.list = [];
    fxk32qModuleAdapter.markHandshakeLost();
    rerender();
    await act(async () => { vi.advanceTimersByTime(200); });
    rerender();

    expect(result.current.deviceOnline).toBe(false);
    expect(result.current.present).toBe(false);
    expect(result.current.reason).toBe('no-device');
  });

  it('clears its polling timer on unmount (no leak)', () => {
    const spy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useFXK32QPresence(50));
    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
