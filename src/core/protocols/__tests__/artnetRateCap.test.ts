/**
 * Fatia 8 #1 + #6 — Art-Net rate cap (33 PPS) and critical-bypass guards.
 *
 * Ensures no caller can drive a universe above the Art-Net 4 receiver cap and
 * that safety-relevant sends (blackout/fire) bypass the throttle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtNetBridge, ARTNET_MIN_INTERVAL_MS } from '../ArtNetBridge';

class FakeWS {
  binaryType = 'arraybuffer';
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: unknown[] = [];
  send(payload: unknown) { this.sent.push(payload); }
  close() { this.onclose?.(); }
}

function connect(bridge: ArtNetBridge): FakeWS {
  const fake = new FakeWS();
  // @ts-expect-error swap WebSocket impl just for the test
  globalThis.WebSocket = vi.fn(() => fake);
  bridge.connect('ws://test');
  fake.onopen?.();
  return fake;
}

describe('Fatia 8 #1 — Art-Net rate cap', () => {
  let bridge: ArtNetBridge;
  let fake: FakeWS;
  const buf = new Uint8Array(512);

  beforeEach(() => {
    bridge = new ArtNetBridge();
    fake = connect(bridge);
  });

  it('drops bursts above 33 PPS for a single universe', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let accepted = 0;
    for (let i = 0; i < 100; i++) {
      if (bridge.sendDmx(0, buf)) accepted++;
      now += 1; // 1ms between calls → only 1 every ARTNET_MIN_INTERVAL_MS gets through
    }
    // 100ms window, ≥30ms gap → at most 4 packets through (t=0,30,60,90).
    expect(accepted).toBeLessThanOrEqual(4);
    expect(bridge.getStats().throttled).toBeGreaterThanOrEqual(96);
  });

  it('allows the next send after MIN_INTERVAL elapses', () => {
    let now = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    expect(bridge.sendDmx(1, buf)).toBe(true);
    now += ARTNET_MIN_INTERVAL_MS - 1;
    expect(bridge.sendDmx(1, buf)).toBe(false);
    now += 2;
    expect(bridge.sendDmx(1, buf)).toBe(true);
  });

  it('rate cap is per-universe (one universe does not throttle another)', () => {
    let now = 9000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    expect(bridge.sendDmx(0, buf)).toBe(true);
    expect(bridge.sendDmx(1, buf)).toBe(true);
    expect(bridge.sendDmx(2, buf)).toBe(true);
    // All three accepted in same tick because each universe has its own clock.
    expect(bridge.getStats().throttled).toBe(0);
  });
});

describe('Fatia 8 #6 — critical sends bypass throttle', () => {
  let bridge: ArtNetBridge;
  const buf = new Uint8Array(512);

  beforeEach(() => {
    bridge = new ArtNetBridge();
    connect(bridge);
  });

  it('critical: true is never throttled even under burst', () => {
    let now = 2000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let accepted = 0;
    for (let i = 0; i < 50; i++) {
      if (bridge.sendDmx(0, buf, { critical: true })) accepted++;
      now += 1;
    }
    expect(accepted).toBe(50);
    expect(bridge.getStats().throttled).toBe(0);
  });

  it('critical send still updates last-send marker (next non-critical respects cadence)', () => {
    let now = 4000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    expect(bridge.sendDmx(0, buf, { critical: true })).toBe(true);
    now += 5;
    // Non-critical follow-up within cap window must be throttled.
    expect(bridge.sendDmx(0, buf)).toBe(false);
  });
});
