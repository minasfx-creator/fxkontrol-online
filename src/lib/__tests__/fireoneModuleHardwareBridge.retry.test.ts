/**
 * Hardware bridge — retry policy tests.
 *
 * The hard rule under test:
 *   PHYSICAL commands (FIRE / BATCH / GPIO / ESTOP) are NEVER auto-retried.
 *   READ commands (CONT / CDS) may retry up to N times, bounded and gated.
 *
 * Retry must also respect:
 *   - link health (abort if not 'healthy')
 *   - session id (abort if reconnect happened mid-retry)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  FireOneHardwareBridge,
  RETRYABLE_COMMAND_TYPES,
  NON_RETRYABLE_COMMAND_TYPES,
  isRetryableCommandType,
  type BridgeCommandType,
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
  const handshakePromise = internals.establishHealthyLink('ble', 'TEST-ESP32');
  await Promise.resolve();
  internals.handleResponse('PONG\n');
  return handshakePromise;
}

describe('FireOneHardwareBridge — retry policy', () => {
  it('whitelist/blacklist sets are disjoint and physical commands are never retryable', () => {
    for (const t of NON_RETRYABLE_COMMAND_TYPES) {
      expect(RETRYABLE_COMMAND_TYPES.has(t)).toBe(false);
      expect(isRetryableCommandType(t)).toBe(false);
    }
    for (const t of ['FIRE', 'BATCH', 'GPIO', 'ESTOP'] as BridgeCommandType[]) {
      expect(isRetryableCommandType(t)).toBe(false);
    }
    for (const t of ['CONT', 'CDS', 'STATUS', 'HEARTBEAT', 'VERSION'] as BridgeCommandType[]) {
      expect(isRetryableCommandType(t)).toBe(true);
    }
  });

  it('1. FIRE timeout never retries — sendCommand called exactly once', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    const firePromise = bridge.fire(3, 100);
    // Don't deliver any OK:FIRE — let it time out.
    const ok = await firePromise.then(v => v).catch(() => false);
    // Wait for FIRE_CONFIRM_TIMEOUT (2000ms) + slack.
    await new Promise(r => setTimeout(r, 2100));
    const result = await Promise.race([firePromise, Promise.resolve('timeout')]);

    expect(result).toBe(false);
    // Exactly one FIRE frame went out — no retry.
    const fires = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('FIRE:'));
    expect(fires.length).toBe(1);
    void ok;
  }, 10000);

  it('2. BATCH timeout never retries — sendCommand called exactly once', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    const batchPromise = bridge.fireBatch(0xff, 100);
    await new Promise(r => setTimeout(r, 2100));
    const result = await Promise.race([batchPromise, Promise.resolve('timeout')]);

    expect(result).toBe(false);
    const batches = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('BATCH:'));
    expect(batches.length).toBe(1);
  }, 10000);

  it('3. setGpio never retries on miss', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    await bridge.setGpio(5, true);
    const gpioCalls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('GPIO:'));
    expect(gpioCalls.length).toBe(1);
  });

  it('4. eStop is fire-and-forget — exactly one transmission attempt, no loop', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    await bridge.eStop();
    const estopCalls = sendSpy.mock.calls.filter(c => String(c[0]) === 'ESTOP\n');
    expect(estopCalls.length).toBe(1);
  });

  it('5. CONT retries up to maxRetries on miss, then resolves 0', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    // Use a short per-attempt timeout via the internal helper directly to keep the test fast.
    const result = await internals.readWithRetry('CONT', 9, /*maxRetries*/ 2, /*perAttemptTimeoutMs*/ 50);

    expect(result).toBe(0);
    const contCalls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:9'));
    // 1 initial + 2 retries = 3
    expect(contCalls.length).toBe(3);
    // retryCount tracked
    expect(bridge.getDiagnostics().retryCount).toBe(2);
  });

  it('6. CONT succeeds on first attempt → no retry, retryCount unchanged', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();
    const baselineRetries = bridge.getDiagnostics().retryCount;

    const promise = internals.readWithRetry('CONT', 4, 2, 200);
    await Promise.resolve();
    internals.handleResponse('CONT:4:1234.5\n');
    const result = await promise;

    expect(result).toBeCloseTo(1234.5);
    const contCalls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:4'));
    expect(contCalls.length).toBe(1);
    expect(bridge.getDiagnostics().retryCount).toBe(baselineRetries);
  });

  it('7. retry aborts when link goes unhealthy mid-retry', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    const promise = internals.readWithRetry('CONT', 1, 5, 30);
    // Let first attempt time out, then disconnect before retry can fire.
    await new Promise(r => setTimeout(r, 40));
    internals.handleDisconnect();

    const result = await promise;
    expect(result).toBe(0);

    const contCalls = sendSpy.mock.calls.filter(c => String(c[0]).startsWith('CONT:1'));
    // Should have stopped well before 6 attempts.
    expect(contCalls.length).toBeLessThanOrEqual(2);
  }, 10000);

  it('8. retry aborts when sessionId changes (reconnect mid-retry)', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    const promise = internals.readWithRetry('CONT', 2, 5, 30);
    await new Promise(r => setTimeout(r, 40));
    // Simulate full disconnect+reconnect cycle.
    internals.handleDisconnect();
    await completeHandshake(bridge, internals);

    const result = await promise;
    expect(result).toBe(0);
    // Session bumped; old retry loop bailed out.
    expect(bridge.getStatus().sessionId).toBeGreaterThan(1);
  }, 10000);
});
