import { describe, it, expect, vi } from 'vitest';
import { SerialTransport, type PyroSubLink } from '@/lib/fireoneTransport';

function makeStubLink(id: string, type = 'two_wire', impl?: { send?: () => Promise<void> }): PyroSubLink & { sendCalls: number } {
  const link = {
    id, type, sendCalls: 0,
    async send(_frame: Uint8Array) {
      this.sendCalls++;
      if (impl?.send) await impl.send();
    },
    async close() { /* noop */ },
  };
  return link;
}

function harness(): SerialTransport {
  const t = new SerialTransport('serial-test');
  // Pretend connected primary writer.
  (t as unknown as { state: string }).state = 'connected';
  (t as unknown as { writer: { write: (b: Uint8Array) => Promise<void> } }).writer = {
    write: vi.fn(async () => { /* primary serial */ }),
  };
  return t;
}

describe('SerialTransport.attachTwoWireSubLink', () => {
  it('registers and exposes the sub-link', () => {
    const t = harness();
    const link = makeStubLink('tw-1');
    t.attachTwoWireSubLink(link);
    expect(t.getSubLinks().map(l => l.id)).toEqual(['tw-1']);
  });

  it('detach is idempotent', () => {
    const t = harness();
    const link = makeStubLink('tw-2');
    const detach = t.attachTwoWireSubLink(link);
    detach();
    detach(); // second call must not throw
    expect(t.getSubLinks()).toHaveLength(0);
  });

  it('sendPyro routes through 2-wire when preferred and present', async () => {
    const t = harness();
    const tw = makeStubLink('tw-3', 'two_wire');
    t.attachTwoWireSubLink(tw);
    const res = await t.sendPyro(new Uint8Array([1, 2, 3]), 'two_wire');
    expect(res.via).toBe('two_wire');
    expect(tw.sendCalls).toBe(1);
  });

  it('sendPyro falls back to primary serial when sub-link send rejects', async () => {
    const t = harness();
    const flaky = makeStubLink('tw-4', 'two_wire', { send: async () => { throw new Error('broken'); } });
    t.attachTwoWireSubLink(flaky);
    const res = await t.sendPyro(new Uint8Array([1]), 'two_wire');
    expect(res.via).toBe('serial');
  });

  it('sendPyro falls back to primary serial when no sub-link attached', async () => {
    const t = harness();
    const res = await t.sendPyro(new Uint8Array([9]));
    expect(res.via).toBe('serial');
  });
});
