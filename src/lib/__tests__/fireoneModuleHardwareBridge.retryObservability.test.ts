/**
 * Hardware bridge — retry observability + configurable policy tests.
 *
 * Locks down:
 *  - retryByCommandType + retryByKey counters
 *  - retry events carry { reason, linkHealth, at }
 *  - setRetryPolicy() overrides defaults and is honored by readContinuity/readCdsVoltage
 *  - DEFAULT_RETRY_POLICY shape is stable
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  FireOneHardwareBridge,
  DEFAULT_RETRY_POLICY,
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

describe('FireOneHardwareBridge — retry observability + policy', () => {
  it('DEFAULT_RETRY_POLICY shape is stable', () => {
    expect(DEFAULT_RETRY_POLICY).toEqual({
      CONT: { maxRetries: 2, perAttemptTimeoutMs: 2000 },
      CDS:  { maxRetries: 2, perAttemptTimeoutMs: 2000 },
    });
  });

  it('1. retryByCommandType + retryByKey accumulate per class and per key', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);

    // Two CONT calls on different pins, all timing out → each does maxRetries=2 retries.
    await internals.readWithRetry('CONT', 1, 2, 20);
    await internals.readWithRetry('CONT', 2, 2, 20);
    await internals.readWithRetry('CDS',  3, 2, 20);

    const diag = bridge.getDiagnostics();
    expect(diag.retryCount).toBe(6);
    expect(diag.retryByCommandType.CONT).toBe(4);
    expect(diag.retryByCommandType.CDS).toBe(2);
    expect(diag.retryByKey['CONT:1']).toBe(2);
    expect(diag.retryByKey['CONT:2']).toBe(2);
    expect(diag.retryByKey['CDS:3']).toBe(2);
  });

  it('2. retry events carry reason, linkHealth, at, sessionId', async () => {
    const { bridge, internals, events } = makeBridge();
    await completeHandshake(bridge, internals);
    events.length = 0;

    await internals.readWithRetry('CONT', 7, 1, 20);

    const retryEvts = events.filter(e => e.event === 'retry');
    expect(retryEvts.length).toBe(1);
    const data = retryEvts[0].data as any;
    expect(data).toMatchObject({
      commandType: 'CONT',
      key: 'CONT:7',
      attempt: 1,
      maxRetries: 1,
      linkHealth: 'healthy',
      reason: 'timeout',
    });
    expect(typeof data.at).toBe('number');
    expect(typeof data.sessionId).toBe('number');
  });

  it('3. parse_miss reason fires when frame arrives malformed', async () => {
    const { bridge, internals, events } = makeBridge();
    await completeHandshake(bridge, internals);
    events.length = 0;

    const promise = internals.readWithRetry('CONT', 5, 1, 200);
    await Promise.resolve();
    // Malformed frame — only 2 segments, no value.
    internals.handleResponse('CONT:5\n');
    // Then deliver a valid frame for the retry.
    await Promise.resolve();
    internals.handleResponse('CONT:5:42.0\n');
    const result = await promise;

    expect(result).toBeCloseTo(42.0);
    const retryEvts = events.filter(e => e.event === 'retry');
    expect(retryEvts.length).toBe(1);
    expect((retryEvts[0].data as any).reason).toBe('parse_miss');
  });

  it('4. setRetryPolicy() overrides maxRetries and perAttemptTimeoutMs', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    bridge.setRetryPolicy({ CONT: { maxRetries: 4, perAttemptTimeoutMs: 15 } });
    expect(bridge.getRetryPolicy().CONT).toEqual({ maxRetries: 4, perAttemptTimeoutMs: 15 });
    // CDS untouched.
    expect(bridge.getRetryPolicy().CDS).toEqual(DEFAULT_RETRY_POLICY.CDS);

    const result = await bridge.readContinuity(8);
    expect(result).toBe(0);
    const contCalls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:8'));
    // 1 initial + 4 retries = 5
    expect(contCalls.length).toBe(5);
    expect(bridge.getDiagnostics().retryByKey['CONT:8']).toBe(4);
  });

  it('5. retryByKey isolates noisy channels', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);

    // Channel 1: noisy (always misses, 2 retries).
    await internals.readWithRetry('CONT', 1, 2, 15);
    // Channel 2: healthy on first try.
    const promise = internals.readWithRetry('CONT', 2, 2, 200);
    await Promise.resolve();
    internals.handleResponse('CONT:2:1000\n');
    await promise;

    const diag = bridge.getDiagnostics();
    expect(diag.retryByKey['CONT:1']).toBe(2);
    expect(diag.retryByKey['CONT:2']).toBeUndefined();
  });
});
