import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireOneController, FireOneCmd, buildFrame } from '@/lib/fireoneProtocol';
import { getTransportManager } from '@/lib/fireoneTransport';

function makeFakeTransport(id: string, type: any, label: string) {
  const recv: Array<(d: Uint8Array, id: string) => void> = [];
  const stCb: Array<(id: string, s: any) => void> = [];
  return {
    id, type, label, priority: 1, state: 'connected' as const,
    latencyMs: 0, txBytes: 0, rxBytes: 0,
    send: vi.fn(async () => {}),
    disconnect: async () => {},
    connect: async () => {},
    onReceive: (cb: any) => recv.push(cb),
    onStateChange: (cb: any) => stCb.push(cb),
    isAvailable: () => true,
    _emit: (d: Uint8Array) => recv.forEach(c => c(d, id)),
  };
}

describe('FireOneController.discoverModules — per-controller', () => {
  beforeEach(() => {
    // wipe singleton between tests
    const mgr: any = getTransportManager();
    (mgr.transports as Map<string, any>).clear();
  });

  it('sweeps every connected transport with IDENTIFY', async () => {
    const mgr: any = getTransportManager();
    const xl4 = makeFakeTransport('xl4', 'wifi_direct', 'XL4 Gateway');
    const xl2 = makeFakeTransport('xl2', 'wifi_direct', 'XL2 Gateway');
    mgr.addTransport(xl4);
    mgr.addTransport(xl2);

    const ctl = new FireOneController();
    await ctl.discoverModules(2);

    expect(xl4.send).toHaveBeenCalledTimes(2);
    expect(xl2.send).toHaveBeenCalledTimes(2);
  });

  it('tags discovered module with the controllerId/label that answered', async () => {
    const mgr: any = getTransportManager();
    const xl4 = makeFakeTransport('xl4', 'wifi_direct', 'XL4 Gateway');
    mgr.addTransport(xl4);

    const ctl = new FireOneController();
    const seen: any[] = [];
    ctl.on((e) => { if (e.type === 'module-discovered') seen.push(e); });

    // Fake a STATUS-shaped payload (32 igniter bytes after 8-byte header).
    const payload = new Uint8Array(8 + 32);
    payload[1] = 0x2E; payload[2] = 0xE0; // batt
    payload[3] = 65; payload[4] = 90; payload[5] = 5; payload[6] = 0;
    const frame = buildFrame(7, FireOneCmd.IDENTIFY, payload);
    xl4._emit(frame);

    expect(seen).toHaveLength(1);
    expect(seen[0].transportId).toBe('xl4');
    expect(seen[0].controllerLabel).toBe('XL4 Gateway');
    expect(seen[0].data.controllerId).toBe('xl4');
    expect(seen[0].data.controllerLabel).toBe('XL4 Gateway');
    expect(seen[0].data.transport).toBe('wifi_direct');
  });
});
