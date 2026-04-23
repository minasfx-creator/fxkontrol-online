/**
 * Hardware bridge session hardening tests.
 *
 * These tests are the safety trap for the false-confirm bug:
 * a disconnect MUST NOT resolve a pending FIRE as confirmed.
 * They also lock down the gate boundary (handshake free, command healthy-only)
 * and the eStop bypass + audit log contract.
 *
 * Strategy: drive the bridge purely through its public API + minimal private
 * hooks (`handleResponse`, `handleDisconnect`) that the real transports also
 * use. We stub `sendCommand` to capture frames without touching real I/O.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FireOneHardwareBridge, type BridgeReasonCode } from '@/lib/fireoneModuleHardwareBridge';

interface CapturedEvent { event: string; data: unknown; }

function makeBridge() {
  const events: CapturedEvent[] = [];
  const bridge = new FireOneHardwareBridge((event, data) => {
    events.push({ event, data });
  });
  const internals = bridge as any;

  // Capture all outgoing frames; never touch real I/O.
  const sentFrames: string[] = [];
  const sendSpy = vi.fn(async (cmd: string) => {
    sentFrames.push(cmd);
    internals.txBytes += cmd.length;
    return true;
  });
  internals.sendCommand = sendSpy;

  return { bridge, internals, events, sentFrames, sendSpy };
}

/** Manually simulate that the transport opened (mimics what setupBLEDevice would do). */
function fakeTransportOpen(internals: any, transport = 'ble') {
  internals.transport = transport;
  internals.deviceName = 'TEST-ESP32';
  // We do NOT set connected=true here — that's the handshake's job.
}

/** Drive a successful handshake: open transport then deliver a PONG line. */
async function completeHandshake(bridge: FireOneHardwareBridge, internals: any) {
  fakeTransportOpen(internals, 'ble');
  const handshakePromise = internals.establishHealthyLink('ble', 'TEST-ESP32');
  // Yield so establishHealthyLink registers PONG/VER resolvers in pendingResolves.
  await Promise.resolve();
  internals.handleResponse('PONG\n');
  return handshakePromise;
}

describe('FireOneHardwareBridge — session hardening', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('1. fire() blocks before a healthy handshake (NOT_CONNECTED)', async () => {
    const { bridge, sendSpy } = makeBridge();
    const ok = await bridge.fire(3, 100);
    expect(ok).toBe(false);
    const status = bridge.getStatus();
    expect(status.connected).toBe(false);
    expect(status.lastErrorCode).toBe<BridgeReasonCode>('NOT_CONNECTED');
    // sendCommand must NOT have been called for FIRE — gate ran first.
    expect(sendSpy).not.toHaveBeenCalledWith(expect.stringContaining('FIRE:'));
  });

  it('1b. fire() blocks during handshake (LINK_NOT_HEALTHY)', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    fakeTransportOpen(internals, 'ble');
    internals.connected = true;          // transport open…
    internals.linkHealth = 'handshaking'; // …but link not yet healthy
    sendSpy.mockClear();
    const ok = await bridge.fire(3, 100);
    expect(ok).toBe(false);
    expect(bridge.getStatus().lastErrorCode).toBe<BridgeReasonCode>('LINK_NOT_HEALTHY');
    expect(sendSpy).not.toHaveBeenCalledWith(expect.stringContaining('FIRE:'));
  });

  it('2. fire() succeeds after handshake when ESP32 confirms with OK:FIRE', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    const handshakeOk = await completeHandshake(bridge, internals);
    expect(handshakeOk).toBe(true);
    expect(bridge.isHealthy()).toBe(true);

    sendSpy.mockClear();
    const firePromise = bridge.fire(7, 250);
    await Promise.resolve(); // let pending resolver register
    // Simulate ESP32 ack frame
    internals.handleResponse('OK:FIRE:7\n');
    const ok = await firePromise;

    expect(ok).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith('FIRE:7:250\n');
  });

  it('3. CRITICAL — disconnect during pending fire() resolves to false (no false confirm)', async () => {
    const { bridge, internals, sendSpy } = makeBridge();
    await completeHandshake(bridge, internals);
    sendSpy.mockClear();

    const firePromise = bridge.fire(5, 500);
    await Promise.resolve(); // pendingResolves now has 'OK:FIRE:5'

    // Sanity: the resolver was registered before disconnect.
    expect(internals.pendingResolves.has('OK:FIRE:5')).toBe(true);

    // Transport drops (BLE GATT disconnect, USB unplug, ws.onclose, …)
    internals.handleDisconnect();

    const ok = await firePromise;
    expect(ok).toBe(false);                       // NOT a confirmation
    expect(bridge.getStatus().connected).toBe(false);
    expect(bridge.getStatus().lastErrorCode).toBe<BridgeReasonCode>('TRANSPORT_DISCONNECTED');
    expect(internals.pendingResolves.size).toBe(0); // drained, not leaked
  });

  it('4. waitForHandshake fails when disconnect happens before PONG/VER', async () => {
    const { bridge, internals } = makeBridge();
    fakeTransportOpen(internals, 'ble');
    const handshakePromise = internals.establishHealthyLink('ble', 'TEST-ESP32');
    await Promise.resolve(); // resolvers registered

    // Transport dies mid-handshake
    internals.handleDisconnect();

    const ok = await handshakePromise;
    expect(ok).toBe(false);
    expect(bridge.isHealthy()).toBe(false);
    expect(bridge.getStatus().linkHealth).toBe('disconnected');
  });

  it('5. eStop() bypasses the gate and emits audit events even on degraded link', async () => {
    const { bridge, internals, events, sendSpy } = makeBridge();
    fakeTransportOpen(internals, 'ble');
    internals.connected = true;
    internals.linkHealth = 'handshaking'; // explicitly NOT healthy
    sendSpy.mockClear();
    events.length = 0;

    const ok = await bridge.eStop();

    expect(sendSpy).toHaveBeenCalledWith('ESTOP\n');
    expect(ok).toBe(true);

    const attempt = events.find(e => e.event === 'estop_attempt');
    const result = events.find(e => e.event === 'estop_result');
    expect(attempt).toBeDefined();
    expect(result).toBeDefined();
    expect((attempt!.data as any).linkHealth).toBe('handshaking');
    expect((attempt!.data as any).connected).toBe(true);
    expect((result!.data as any).ok).toBe(true);
  });

  it('6. Stale session: handshake reply from a previous attempt does NOT promote the link', async () => {
    const { bridge, internals } = makeBridge();
    fakeTransportOpen(internals, 'ble');
    const handshakePromise = internals.establishHealthyLink('ble', 'TEST-ESP32');
    await Promise.resolve();

    // Simulate that another disconnect/connect cycle happened mid-handshake
    // (this is exactly what handleDisconnect does, plus a competing attempt).
    internals.connectingSessionId++;

    // Late PONG from the stale attempt arrives now.
    internals.handleResponse('PONG\n');

    const ok = await handshakePromise;
    expect(ok).toBe(false);
    expect(bridge.isHealthy()).toBe(false);
    expect(bridge.getStatus().lastErrorCode).toBe<BridgeReasonCode>('STALE_SESSION');
  });

  it('disconnected event payload carries full reconstruction context', async () => {
    const { bridge, internals, events } = makeBridge();
    await completeHandshake(bridge, internals);
    events.length = 0;

    internals.handleDisconnect();

    const disconnectEvt = events.find(e => e.event === 'disconnected');
    expect(disconnectEvt).toBeDefined();
    const payload = disconnectEvt!.data as any;
    expect(payload).toMatchObject({
      reasonCode: 'TRANSPORT_DISCONNECTED',
      transport: 'none',
      linkHealth: 'disconnected',
    });
    expect(typeof payload.sessionId).toBe('number');
    expect(typeof payload.at).toBe('number');
  });

  it('sessionId increments on every successful handshake', async () => {
    const { bridge, internals } = makeBridge();
    expect(bridge.getStatus().sessionId).toBe(0);

    await completeHandshake(bridge, internals);
    const firstSession = bridge.getStatus().sessionId;
    expect(firstSession).toBe(1);

    internals.handleDisconnect();
    await completeHandshake(bridge, internals);
    expect(bridge.getStatus().sessionId).toBe(firstSession + 1);
  });
});
