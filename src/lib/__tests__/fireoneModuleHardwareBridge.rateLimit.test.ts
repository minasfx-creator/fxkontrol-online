/**
 * Hardware bridge — retry rate limiting + noisy-channel protection tests.
 *
 * Hard rules under test:
 *  1. A noisy key (CONT:1) hitting `maxRetriesPerKey` is suppressed.
 *  2. A different key (CONT:2) keeps working — per-key isolation.
 *  3. Global ceiling (`maxRetriesTotal`) blocks retries across all keys.
 *  4. Sliding window expiration re-allows retries.
 *  5. Physical commands (FIRE/BATCH/GPIO) are unaffected by the limiter —
 *     they never retry, so the limiter is irrelevant to them.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  FireOneHardwareBridge,
  DEFAULT_RETRY_RATE_LIMIT,
  type BridgeReasonCode,
} from '@/lib/fireoneModuleHardwareBridge';

interface CapturedEvent { event: string; data: unknown; }

function makeBridge() {
  const events: CapturedEvent[] = [];
  const bridge = new FireOneHardwareBridge((event, data) => {
    events.push({ event, data });
  });
  const internals = bridge as any;
  const sentFrames: string[] = [];
  const sendSpy = vi.fn(async (cmd: string) => {
    sentFrames.push(cmd);
    internals.txBytes += cmd.length;
    return true;
  });
  internals.sendCommand = sendSpy;
  return { bridge, internals, events, sentFrames, sendSpy };
}

async function completeHandshake(bridge: FireOneHardwareBridge, internals: any) {
  internals.transport = 'ble';
  internals.deviceName = 'TEST-ESP32';
  const p = internals.establishHealthyLink('ble', 'TEST-ESP32');
  await Promise.resolve();
  internals.handleResponse('PONG\n');
  return p;
}

describe('FireOneHardwareBridge — retry rate limiting', () => {
  it('DEFAULT_RETRY_RATE_LIMIT shape is stable', () => {
    expect(DEFAULT_RETRY_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRetriesPerKey: 10,
      maxRetriesTotal: 60,
    });
  });

  it('1. CONT:1 exceeding per-key limit is suppressed with RETRY_RATE_LIMITED', async () => {
    const { bridge, internals, events, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    bridge.setRetryRateLimit({ windowMs: 60_000, maxRetriesPerKey: 2, maxRetriesTotal: 100 });
    sendSpy.mockClear();

    // First call: 2 retries consumed (allowed), then resolves 0.
    await internals.readWithRetry('CONT', 1, 5, 15);
    // Second call on SAME key: per-key budget is full → first retry attempt suppressed.
    await internals.readWithRetry('CONT', 1, 5, 15);

    expect(bridge.getStatus().lastErrorCode).toBe<BridgeReasonCode>('RETRY_RATE_LIMITED');
    const limited = events.filter(e => e.event === 'retry_rate_limited');
    expect(limited.length).toBeGreaterThan(0);
    const data = limited[0].data as any;
    expect(data.key).toBe('CONT:1');
    expect(data.scope).toBe('per_key');
    expect(bridge.getDiagnostics().rateLimitedByKey['CONT:1']).toBeGreaterThan(0);
    expect(bridge.getDiagnostics().rateLimitedTotal).toBeGreaterThan(0);
  });

  it('2. Per-key suppression on CONT:1 does not block CONT:2', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    bridge.setRetryRateLimit({ windowMs: 60_000, maxRetriesPerKey: 2, maxRetriesTotal: 100 });

    // Burn CONT:1's per-key budget.
    await internals.readWithRetry('CONT', 1, 5, 15);
    await internals.readWithRetry('CONT', 1, 5, 15);

    sendSpy.mockClear();
    // CONT:2 has its own budget — should still retry up to 2.
    await internals.readWithRetry('CONT', 2, 5, 15);
    const cont2Calls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:2'));
    // 1 initial + 2 retries = 3 sends.
    expect(cont2Calls.length).toBe(3);
    expect(bridge.getDiagnostics().retryByKey['CONT:2']).toBe(2);
  });

  it('3. Global ceiling (maxRetriesTotal) blocks retries across all keys', async () => {
    const { bridge, internals, events } = makeBridge();
    await completeHandshake(bridge, internals);
    bridge.setRetryRateLimit({ windowMs: 60_000, maxRetriesPerKey: 100, maxRetriesTotal: 3 });

    // Fill the global window with retries across distinct keys.
    await internals.readWithRetry('CONT', 1, 2, 10); // +2 retries
    await internals.readWithRetry('CONT', 2, 2, 10); // tries +2 but global cap=3 trips

    const limited = events.filter(e => e.event === 'retry_rate_limited');
    expect(limited.some(l => (l.data as any).scope === 'total')).toBe(true);
    expect(bridge.getDiagnostics().retryCount).toBeLessThanOrEqual(3);
  });

  it('4. Sliding window expiration re-allows retries', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    // Tiny window so it actually expires within the test.
    bridge.setRetryRateLimit({ windowMs: 80, maxRetriesPerKey: 1, maxRetriesTotal: 100 });

    // Burn the budget for CONT:5.
    await internals.readWithRetry('CONT', 5, 3, 10);
    const beforeRecover = bridge.getDiagnostics().rateLimitedByKey['CONT:5'] ?? 0;
    expect(beforeRecover).toBeGreaterThan(0);

    // Wait past the window.
    await new Promise(r => setTimeout(r, 120));
    sendSpy.mockClear();

    // Retries allowed again.
    await internals.readWithRetry('CONT', 5, 1, 10);
    const sends = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:5'));
    // 1 initial + 1 retry (per-key cap=1) = 2 sends.
    expect(sends.length).toBe(2);
  });

  it('5. Physical commands are unaffected by the rate limiter', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    bridge.setRetryRateLimit({ windowMs: 60_000, maxRetriesPerKey: 0, maxRetriesTotal: 0 });
    sendSpy.mockClear();

    // Even with the limiter at zero, physical commands transmit exactly once
    // because they never retry — limiter is only consulted in readWithRetry.
    const fp = bridge.fire(3, 100);
    await Promise.resolve();
    internals.handleResponse('OK:FIRE:3\n');
    expect(await fp).toBe(true);

    const fires = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('FIRE:'));
    expect(fires.length).toBe(1);

    // setGpio also unaffected.
    sendSpy.mockClear();
    await bridge.setGpio(2, true);
    expect(sendSpy.mock.calls.filter(c => String(c[0]).startsWith('GPIO:')).length).toBe(1);

    // eStop also unaffected.
    sendSpy.mockClear();
    await bridge.eStop();
    expect(sendSpy.mock.calls.filter(c => String(c[0]) === 'ESTOP\n').length).toBe(1);
  });
});
