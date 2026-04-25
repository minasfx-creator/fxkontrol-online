/**
 * Fatia 8 #2 — Art-Net hot-path zero-GC budget.
 *
 * Microbench guardian: 1000 sends over a 512-byte universe must stay under a
 * conservative wall-clock budget AND must not trigger the JSON.stringify of
 * a 512-element JS Array (the regression we are guarding against).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtNetBridge } from '../ArtNetBridge';

class FakeWS {
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  payloads: string[] = [];
  send(p: string) { this.payloads.push(p); }
  close() {}
}

describe('Fatia 8 #2 — Art-Net zero-GC payload', () => {
  let bridge: ArtNetBridge;
  let fake: FakeWS;
  const buf = new Uint8Array(512);
  for (let i = 0; i < 512; i++) buf[i] = i & 0xff;

  beforeEach(() => {
    bridge = new ArtNetBridge();
    fake = new FakeWS();
    // @ts-expect-error swap WS for the test
    globalThis.WebSocket = vi.fn(() => fake);
    bridge.connect('ws://test');
    fake.onopen?.();
  });

  it('payload is a base64 string, NOT a JSON Array(512) (regression sentinel)', () => {
    const before = fake.payloads.length; // ArtPoll on connect
    bridge.sendDmx(0, buf, { critical: true });
    const fresh = fake.payloads.slice(before);
    expect(fresh.length).toBe(1);
    const sent = JSON.parse(fresh[0]) as { op: string; data: unknown };
    expect(sent.op).toBe('ArtDmx');
    // Must be string (base64), not array — the old impl serialized Array.from(buf).
    expect(typeof sent.data).toBe('string');
    // 512 bytes → ≤ 688 base64 chars; must NOT be huge JSON list (~2KB).
    expect((sent.data as string).length).toBeLessThan(800);
  });

  it('1000 critical sends complete under 100ms wall-clock budget', () => {
    const baseline = bridge.getStats().sent;
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      bridge.sendDmx(i % 16, buf, { critical: true });
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(100);
    expect(bridge.getStats().sent - baseline).toBe(1000);
  });
});
