/**
 * Hardware bridge — out-of-order response + diagnostics tests.
 *
 * Locks down:
 *  - late OK:FIRE:1 after FIRE:2 was sent must resolve the right pending
 *  - duplicate OK:FIRE:N must not cross-confirm a different pending
 *  - response from previous session is dropped via stale_response_dropped
 *  - getDiagnostics() reports queue size, oldest age, sessionId, linkHealth
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { FireOneHardwareBridge } from '@/lib/fireoneModuleHardwareBridge';

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

describe('FireOneHardwareBridge — response ordering', () => {
  it('1. resolves the correct pending when responses arrive out of order', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);

    const fire1 = bridge.fire(1, 100);
    const fire2 = bridge.fire(2, 100);
    await Promise.resolve();

    expect(internals.pendingResolves.has('OK:FIRE:1')).toBe(true);
    expect(internals.pendingResolves.has('OK:FIRE:2')).toBe(true);

    // Pin 2 confirms first.
    internals.handleResponse('OK:FIRE:2\n');
    // Then pin 1.
    internals.handleResponse('OK:FIRE:1\n');

    expect(await fire1).toBe(true);
    expect(await fire2).toBe(true);
    expect(internals.pendingResolves.size).toBe(0);
  });

  it('2. duplicate OK:FIRE:N does not cross-confirm a different pending', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);

    const fire5 = bridge.fire(5, 100);
    await Promise.resolve();
    internals.handleResponse('OK:FIRE:5\n');
    expect(await fire5).toBe(true);

    // Now fire a different pin — a duplicate OK:FIRE:5 frame must NOT confirm it.
    const fire7 = bridge.fire(7, 100);
    await Promise.resolve();
    internals.handleResponse('OK:FIRE:5\n');   // stale duplicate
    // Pin 7 still pending
    expect(internals.pendingResolves.has('OK:FIRE:7')).toBe(true);
    internals.handleResponse('OK:FIRE:7\n');
    expect(await fire7).toBe(true);
  });

  it('3. response with mismatched session is dropped + emits stale_response_dropped', async () => {
    const { bridge, internals, events } = makeBridge();
    await completeHandshake(bridge, internals);

    // Manually inject a pending response from an OLDER session.
    const staleKey = 'OK:FIRE:42';
    let resolved: string | null = null;
    internals.pendingResolves.set(staleKey, {
      key: staleKey,
      commandType: 'CONFIRM',
      sessionId: 0, // older than current (1) and connectingSessionId
      createdAt: Date.now() - 5000,
      resolver: (val: string) => { resolved = val; },
    });
    events.length = 0;

    internals.handleResponse('OK:FIRE:42\n');

    // Resolver must NOT have been called with the frame.
    expect(resolved).toBeNull();
    // Pending was cleaned up.
    expect(internals.pendingResolves.has(staleKey)).toBe(false);
    // Event was emitted.
    const dropped = events.find(e => e.event === 'stale_response_dropped');
    expect(dropped).toBeDefined();
    expect((dropped!.data as any).key).toBe(staleKey);
  });

  it('4. getDiagnostics() reports queue size, oldest age, sessionId, linkHealth', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);

    expect(bridge.getDiagnostics()).toMatchObject({
      pendingCount: 0,
      pendingKeys: [],
      oldestPendingAgeMs: 0,
      linkHealth: 'healthy',
    });

    bridge.fire(3, 100);
    bridge.fire(4, 100);
    await Promise.resolve();

    const diag = bridge.getDiagnostics();
    expect(diag.pendingCount).toBe(2);
    expect(diag.pendingKeys).toEqual(expect.arrayContaining(['OK:FIRE:3', 'OK:FIRE:4']));
    expect(diag.linkHealth).toBe('healthy');
    expect(diag.sessionId).toBe(1);
    expect(diag.oldestPendingAgeMs).toBeGreaterThanOrEqual(0);
  });

  it('5. getStatus() embeds the same diagnostics snapshot', async () => {
    const { bridge, internals } = makeBridge();
    await completeHandshake(bridge, internals);
    bridge.fire(8, 100);
    await Promise.resolve();

    const status = bridge.getStatus();
    expect(status.diagnostics).toBeDefined();
    expect(status.diagnostics!.pendingCount).toBe(1);
    expect(status.diagnostics!.pendingKeys).toContain('OK:FIRE:8');
  });
});
