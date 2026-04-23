import { describe, expect, it, vi } from 'vitest';
import {
  PYRO_USB_DEFAULT_LATENCY_MS,
  PyroUsbTransport,
  type PyroUsbPortAdapter,
} from './pyroUsb';

function createAdapter(): PyroUsbPortAdapter & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
  };
}

describe('PyroUsbTransport', () => {
  it('arms before fire and emits deterministic PBUS frames', async () => {
    const adapter = createAdapter();
    const transport = new PyroUsbTransport(adapter);

    await transport.arm(7, 1000);
    await transport.fire(7, 3, 400, 1010);

    expect(adapter.send).toHaveBeenCalledTimes(2);
    expect(adapter.send.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(adapter.send.mock.calls[1][0]).toBeInstanceOf(Uint8Array);
    expect(transport.getState()).toBe('armed');
    expect(transport.getDiagnostics(1010).armedModules).toEqual([7]);
  });

  it('blocks fire when module is not armed', async () => {
    const transport = new PyroUsbTransport(createAdapter());

    await expect(transport.fire(7, 1)).rejects.toThrow('Pyro module 7 must be armed before fire');
  });

  it('enters lockout when watchdog expires', async () => {
    const adapter = createAdapter();
    const transport = new PyroUsbTransport(adapter, { watchdogTimeoutMs: 100 });

    await transport.arm(2, 1000);

    await expect(transport.serviceWatchdog(1101)).resolves.toBe(true);
    expect(transport.getState()).toBe('lockout');
    expect(transport.getDiagnostics(1101).lockoutReason).toBe('watchdog');
    expect(adapter.send).toHaveBeenCalledTimes(2);
  });

  it('supports manual lockout and clear cycle', async () => {
    const adapter = createAdapter();
    const transport = new PyroUsbTransport(adapter);

    await transport.arm(1, 1000);
    await transport.enableLockout('manual', 1010);
    expect(transport.getState()).toBe('lockout');

    transport.clearLockout();
    expect(transport.getState()).toBe('idle');
  });

  it('returns frozen diagnostics and default latency constant', async () => {
    const transport = new PyroUsbTransport(createAdapter());
    await transport.arm(3, 1000);
    const diagnostics = transport.getDiagnostics(1000);

    expect(PYRO_USB_DEFAULT_LATENCY_MS).toBe(12);
    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(Object.isFrozen(diagnostics.armedModules)).toBe(true);
  });
});