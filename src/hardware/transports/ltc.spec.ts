import { describe, expect, it, vi } from 'vitest';
import { LTCTransport } from './ltc';

describe('LTCTransport', () => {
  it('locks after hysteresis frames and then applies rate correction without direct snaps', () => {
    const syncExternalTime = vi.fn();
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
          syncExternalTime(time);
        },
        setRate,
      },
      { smoothingFactor: 0.15, lockFrames: 3, maxCorrectionPerFrame: 0.04 },
    );

    expect(transport.ingestTime(10.033, 1000)).toBeNull();
    expect(transport.ingestTime(10.036, 1033)).toBeNull();
    expect(transport.ingestTime(10.04, 1066)).toBeNull();
    const first = transport.ingestTime(10.05, 1099);
    const second = transport.ingestTime(10.06, 1132);

    expect(first).toMatchObject({ mode: 'rate', state: 'locked' });
    expect(first?.syncedTime).toBeCloseTo(10, 6);
    expect(first?.rate).toBeGreaterThan(1);
    expect(second?.mode).toBe('rate');
    expect(second?.rate).toBeGreaterThan(first?.rate ?? 1);
    expect(syncExternalTime).not.toHaveBeenCalled();
    expect(setRate).toHaveBeenCalledTimes(2);
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

    expect(sample).toMatchObject({ mode: 'soft', state: 'locked', syncedTime: 10 });
    expect(syncExternalTime).not.toHaveBeenCalled();
  });

  it('hard resyncs on large forward jumps and rewind detection', () => {
    const syncExternalTime = vi.fn();
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
          syncExternalTime(time);
        },
        setRate,
      },
      { lockFrames: 1, hardResyncThreshold: 0.5, rewindThreshold: 0.1 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    const forward = transport.ingestTime(10.75, 1033);
    const backward = transport.ingestTime(9.9, 1066);

    expect(forward).toMatchObject({ mode: 'hard', syncedTime: 10.75, state: 'locked' });
    expect(backward).toMatchObject({ mode: 'hard', syncedTime: 9.9, state: 'locked' });
    expect(forward?.reason).toBe('hard-resync');
    expect(backward?.reason).toBe('rewind-detect');
    expect(setRate).toHaveBeenNthCalledWith(1, 1);
    expect(setRate).toHaveBeenNthCalledWith(2, 1);
  });

  it('enters freewheel after sustained signal loss', () => {
    const releaseExternalSync = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
        },
        releaseExternalSync,
        setRate: vi.fn(),
      },
      { pauseTimeoutMs: 250, lockFrames: 1, unlockFrames: 3 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    transport.ingestTime(10.02, 1033);

    expect(transport.isSignalPresent(1301)).toBe(false);
    expect(transport.isSignalPresent(1302)).toBe(false);
    expect(transport.isSignalPresent(1303)).toBe(false);
    expect(transport.getState()).toBe('freewheel');
    expect(transport.getEvents().some((event) => event.type === 'freewheel')).toBe(true);
    expect(releaseExternalSync).not.toHaveBeenCalled();
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
    expect(diagnostics.lastSequence).toBe(1);
  });

  it('records drift telemetry with raw, filtered and clock traces', () => {
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
        },
        setRate,
      },
      { lockFrames: 1 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    [10.033, 10.066, 10.099].forEach((time, index) => {
      currentTime = time - 0.001;
      transport.ingestTime(time, 1033 + index * 33);
    });

    const telemetry = transport.getTelemetrySeries();
    expect(telemetry.drift.length).toBe(3);
    expect(telemetry.raw.length).toBe(3);
    expect(telemetry.filtered.length).toBe(3);
    expect(telemetry.clock.length).toBe(3);
  });

  it('detects frame drops without brutal snap when drift is still bounded', () => {
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
        },
        setRate,
      },
      { lockFrames: 1, hardResyncThreshold: 0.5 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    currentTime = 10.001;
    transport.ingestTime(10.033, 1033);
    currentTime = 10.034;
    const sample = transport.ingestTime(10.099, 1066);

    expect(sample?.mode).toBe('rate');
    expect(transport.getEvents().some((event) => event.type === 'drop')).toBe(true);
  });

  it('hard resyncs on extreme jumps and resets the integrator', () => {
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport(
      {
        getTime: () => currentTime,
        syncExternalTime: (time) => {
          currentTime = time;
        },
        setRate,
      },
      { lockFrames: 1, hardResyncThreshold: 0.5 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    currentTime = 10.03;
    transport.ingestTime(10.033, 1033);
    const hard = transport.ingestTime(30, 1066);
    const diagnostics = transport.getDriftDiagnostics();

    expect(hard).toMatchObject({ mode: 'hard', reason: 'hard-resync', rate: 1 });
    expect(diagnostics.integral).toBe(0);
    expect(diagnostics.rate).toBe(1);
  });

  it('supports configurable chase mode including external-master', () => {
    const syncExternalTime = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: (time) => {
        currentTime = time;
        syncExternalTime(time);
      },
      setRate: vi.fn(),
    }, { lockFrames: 1 });

    transport.setChaseMode('external-master');
    expect(transport.ingestTime(10, 1000)).toBeNull();
    const sample = transport.ingestTime(10.5, 1033);

    expect(sample).toMatchObject({ mode: 'hard', reason: 'external-master', syncedTime: 10.5 });
    expect(syncExternalTime).toHaveBeenCalledWith(10.5);
  });

  it('supports kalman filtering and event export/subscription', () => {
    const received: string[] = [];
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: () => {},
      setRate: () => {},
    }, { lockFrames: 1 });

    const unsubscribe = transport.subscribeEvents((event) => {
      received.push(event.type);
    });

    transport.setKalmanEnabled(true);
    expect(transport.isKalmanEnabled()).toBe(true);
    expect(transport.ingestTime(10, 1000, 'A', 1)).toBeNull();
    currentTime = 10;
    transport.ingestTime(10.066, 1033, 'A', 1);

    unsubscribe();
    const exported = transport.exportEvents();
    expect(exported).toContain('rate-change');
    expect(received).toContain('rate-change');
  });

  it('replays recorded output byte-for-byte without recomputing the filter', () => {
    const syncExternalTime = vi.fn();
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: (time) => {
        currentTime = time;
        syncExternalTime(time);
      },
      setRate,
    }, { lockFrames: 1 });

    transport.setKalmanEnabled(true);
    expect(transport.ingestTime(10, 1000, 'A', 1)).toBeNull();
    currentTime = 10.02;
    transport.ingestTime(10.033, 1033, 'A', 1);
    currentTime = 10.05;
    transport.ingestTime(10.066, 1066, 'A', 1);

    const record = transport.getReplayRecord();
    const jsonA = JSON.stringify(record);
    transport.replay(record);
    const jsonB = JSON.stringify(transport.getReplayRecord());

    expect(jsonB).toBe(jsonA);
  });
});
