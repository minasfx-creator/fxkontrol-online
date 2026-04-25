/**
 * useUSBDMXBroadcast — toggle stress test
 *
 * Valida as duas garantias de gerenciamento de recursos do hook
 * (Core memory rule: clear timers no unmount, sem empilhamento):
 *
 *  1) Alternar enabled (Iniciar/Parar) várias vezes NÃO acumula
 *     setIntervals — apenas um timer ativo de cada vez, e zero
 *     timers ativos quando enabled=false ou no unmount.
 *  2) Se uma chamada `sendDMXToAll` está em vôo (lenta), o próximo
 *     tick é DESCARTADO em vez de empilhar promessas concorrentes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUSBDMXBroadcast } from '@/hooks/useUSBDMXBroadcast';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';

// ── Helpers ──────────────────────────────────────────────────────────
function countActiveTimers(
  setSpy: ReturnType<typeof vi.spyOn>,
  clearSpy: ReturnType<typeof vi.spyOn>
): number {
  return setSpy.mock.calls.length - clearSpy.mock.calls.length;
}

function seedConnectedDevice() {
  // Bypass do setter normal — injeta um device "conectado" mínimo.
  useUSBDeviceStore.setState({
    dmxDevices: [
      {
        id: 'mock-dmx-1',
        label: 'Mock ENTTEC',
        type: 'dmx' as const,
        state: 'connected' as const,
        // outros campos não são lidos pelo hook
      } as any,
    ],
  });
}

function clearDevices() {
  useUSBDeviceStore.setState({ dmxDevices: [] });
}

const FRAME = new Uint8Array(512).fill(0);

// ── Setup ────────────────────────────────────────────────────────────
let setIntervalSpy: ReturnType<typeof vi.spyOn>;
let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  setIntervalSpy = vi.spyOn(window, 'setInterval');
  clearIntervalSpy = vi.spyOn(window, 'clearInterval');
  seedConnectedDevice();
});

afterEach(() => {
  setIntervalSpy.mockRestore();
  clearIntervalSpy.mockRestore();
  vi.useRealTimers();
  clearDevices();
});

// ── Tests ────────────────────────────────────────────────────────────
describe('useUSBDMXBroadcast — start/stop sem leak nem empilhamento', () => {
  it('alternar enabled 10x deixa zero timers ativos quando off e exatamente 1 quando on', async () => {
    const sendSpy = vi.fn(async () => ({ deviceCount: 1, totalBytes: 512, latencyMs: 1 }));
    useUSBDeviceStore.setState({ sendDMXToAll: sendSpy as any });

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useUSBDMXBroadcast({
          getChannels: () => FRAME,
          fps: 40,
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(countActiveTimers(setIntervalSpy, clearIntervalSpy)).toBe(0);

    for (let i = 0; i < 10; i++) {
      rerender({ enabled: true });
      // exatamente 1 interval ativo enquanto streaming
      expect(countActiveTimers(setIntervalSpy, clearIntervalSpy)).toBe(1);

      rerender({ enabled: false });
      // 0 intervals ativos após parar — sem leak
      expect(countActiveTimers(setIntervalSpy, clearIntervalSpy)).toBe(0);
    }

    unmount();
    expect(countActiveTimers(setIntervalSpy, clearIntervalSpy)).toBe(0);
  });

  it('não empilha envios: tick descarta enquanto sendDMXToAll anterior está em vôo', async () => {
    // sendDMXToAll lento: 200ms — supera vários ticks @ 40Hz (25ms).
    let resolveCurrent: (() => void) | null = null;
    const sendSpy = vi.fn(
      () =>
        new Promise<{ deviceCount: number; totalBytes: number; latencyMs: number }>(resolve => {
          resolveCurrent = () => resolve({ deviceCount: 1, totalBytes: 512, latencyMs: 200 });
        })
    );
    useUSBDeviceStore.setState({ sendDMXToAll: sendSpy as any });

    renderHook(() =>
      useUSBDMXBroadcast({
        getChannels: () => FRAME,
        fps: 40, // ~25ms entre ticks
        enabled: true,
      })
    );

    // Avança 250ms — deveriam ter ocorrido ~10 ticks de timer,
    // mas como o primeiro send está pendurado, todos os outros são descartados.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Resolve o envio em vôo — próximos ticks voltam a passar (1 por intervalo).
    await act(async () => {
      resolveCurrent?.();
      await vi.advanceTimersByTimeAsync(30);
    });
    // Após liberar o in-flight, o próximo tick dispara — sem catch-up empilhado.
    expect(sendSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(sendSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('unmount durante streaming limpa o timer (clearInterval chamado)', () => {
    const sendSpy = vi.fn(async () => ({ deviceCount: 1, totalBytes: 512, latencyMs: 1 }));
    useUSBDeviceStore.setState({ sendDMXToAll: sendSpy as any });

    const { unmount } = renderHook(() =>
      useUSBDMXBroadcast({ getChannels: () => FRAME, fps: 40, enabled: true })
    );

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(0);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(countActiveTimers(setIntervalSpy, clearIntervalSpy)).toBe(0);
  });
});
