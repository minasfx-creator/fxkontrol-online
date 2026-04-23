import { describe, expect, it, vi } from 'vitest';
import { LTCTransport } from './ltc';

describe('LTCTransport', () => {
  it('locks after hysteresis frames and then softens small corrections with clamp', () => {
    const syncExternalTime = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
          syncExternalTime(time);
        },
      },
      { smoothingFactor: 0.15, lockFrames: 3, maxCorrectionPerFrame: 0.04 },
    );

    expect(transport.ingestTime(10.033, 1000)).toBeNull();
    expect(transport.ingestTime(10.036, 1033)).toBeNull();
    const first = transport.ingestTime(10.04, 1066);
    const second = transport.ingestTime(10.05, 1099);

    expect(first).toMatchObject({ mode: 'soft' });
    expect(first?.state).toBe('locked-soft');
    expect(first?.syncedTime).toBeCloseTo(10.006, 6);
    expect(second?.mode).toBe('soft');
    expect(second?.syncedTime).toBeCloseTo(10.012, 6);
    expect(syncExternalTime).toHaveBeenCalledTimes(2);
    expect(syncExternalTime.mock.lastCall?.[0]).toBeCloseTo(10.012, 6);
  });

  it('uses deadband to ignore micro jitter after lock', () => {
    const syncExternalTime = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
          syncExternalTime(time);
        },
      },
      { lockFrames: 1, deadbandSec: 0.01 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    const sample = transport.ingestTime(10.005, 1033);

    expect(sample).toMatchObject({ mode: 'soft' });
    expect(sample?.syncedTime).toBe(10);
    expect(syncExternalTime).not.toHaveBeenCalled();
  });

  it('hard resyncs on large forward jumps and rewind detection', () => {
    const syncExternalTime = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
          syncExternalTime(time);
        },
      },
      { lockFrames: 1, hardResyncThreshold: 0.5, rewindThreshold: 0.1 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    const forward = transport.ingestTime(10.75, 1033);
    const backward = transport.ingestTime(9.9, 1066);

    expect(forward).toMatchObject({ mode: 'hard', syncedTime: 10.75, state: 'locked-hard' });
    expect(backward).toMatchObject({ mode: 'hard', syncedTime: 9.9, state: 'locked-hard' });
    expect(syncExternalTime).toHaveBeenNthCalledWith(1, 10.75);
    expect(syncExternalTime).toHaveBeenNthCalledWith(2, 9.9);
  });

  it('releases external sync only after unlock hysteresis on signal loss', () => {
    const syncExternalTime = vi.fn();
    const releaseExternalSync = vi.fn();
    const transport = new LTCTransport(
      {
        getTime: () => 10,
        syncExternalTime,
        releaseExternalSync,
      },
      { pauseTimeoutMs: 250, lockFrames: 1, unlockFrames: 3 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    transport.ingestTime(10.02, 1033);

    expect(transport.isSignalPresent(1200)).toBe(true);
    expect(transport.isSignalPresent(1301)).toBe(false);
    expect(transport.isSignalPresent(1302)).toBe(false);
    expect(releaseExternalSync).not.toHaveBeenCalled();
    expect(transport.isSignalPresent(1303)).toBe(false);
    expect(releaseExternalSync).toHaveBeenCalledTimes(1);
    expect(transport.getState()).toBe('lost');

    transport.ingestTime(10.04, 1400);
    expect(transport.isSignalPresent(1500)).toBe(true);
  });

  it('returns immutable diagnostics', () => {
    const transport = new LTCTransport({
      getTime: () => 0,
      syncExternalTime: () => {},
    });

    transport.ingestTime(1, 1000);
    const diagnostics = transport.getDiagnostics(1100);

    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(diagnostics.signalPresent).toBe(true);
    expect(diagnostics.lastIncomingTime).toBe(1);
    expect(diagnostics.state).toBe('locking');
  });
});