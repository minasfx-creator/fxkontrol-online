import { describe, it, expect, vi } from 'vitest';
import { scanBus } from '../twoWireBusDiscovery';
import { TwoWireOpcode } from '../twoWireProtocol';

function mockTransport(replyFor: Set<number>) {
  const frameSubs: Array<(f: { addr: number; opcode: TwoWireOpcode; payload: Uint8Array }) => void> = [];
  return {
    send: vi.fn(async (cmd: { type: string; addr: number }) => {
      if (cmd.type === 'IDENTIFY' && replyFor.has(cmd.addr)) {
        // Simulate firmware reply on next tick.
        setTimeout(() => {
          for (const cb of frameSubs) {
            cb({ addr: cmd.addr, opcode: TwoWireOpcode.IDENTIFY, payload: new Uint8Array([0x10, 1, 2, 3]) });
          }
        }, 1);
      }
    }),
    onFrame: (cb: (f: { addr: number; opcode: TwoWireOpcode; payload: Uint8Array }) => void) => {
      frameSubs.push(cb);
      return () => { frameSubs.splice(frameSubs.indexOf(cb), 1); };
    },
  };
}

describe('twoWireBusDiscovery — scanBus', () => {
  it('identifies live addresses', async () => {
    const t = mockTransport(new Set([1, 5, 17]));
    const r = await scanBus(t, { addrs: [1, 2, 5, 17, 31], timeoutPerAddrMs: 30, spacingMs: 0 });
    const live = r.modules.filter((m) => m.status === 'live').map((m) => m.addr).sort();
    expect(live).toEqual([1, 5, 17]);
    const unseen = r.modules.filter((m) => m.status === 'unseen').map((m) => m.addr).sort();
    expect(unseen).toEqual([2, 31]);
  });

  it('returns unseen for empty bus (honest, no synthetic data)', async () => {
    const t = mockTransport(new Set());
    const r = await scanBus(t, { addrs: [1, 2, 3], timeoutPerAddrMs: 20, spacingMs: 0 });
    expect(r.modules.every((m) => m.status === 'unseen')).toBe(true);
  });

  it('decodes fwVersion + deviceType when payload present', async () => {
    const t = mockTransport(new Set([7]));
    const r = await scanBus(t, { addrs: [7], timeoutPerAddrMs: 30, spacingMs: 0 });
    expect(r.modules[0].fwVersion).toBe('1.2.3');
    expect(r.modules[0].deviceType).toBe('0x10');
  });

  it('completes 32 addrs in <2.5s under mock timing', async () => {
    const t = mockTransport(new Set([1, 16, 32]));
    const r = await scanBus(t, { timeoutPerAddrMs: 50, spacingMs: 1 });
    expect(r.durationMs).toBeLessThan(2500);
    expect(r.modules.length).toBe(32);
  });
});
