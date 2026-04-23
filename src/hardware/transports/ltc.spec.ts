import { describe, expect, it, vi } from 'vitest';
import { LTCTransport } from './ltc';

describe('LTCTransport', () => {
  it('locks after hysteresis frames and then softens small corrections with clamp', () => {
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

    expect(first).toMatchObject({ mode: 'rate' });
    expect(first?.state).toBe('locked-soft');
    expect(first?.syncedTime).toBeCloseTo(10, 6);
    expect(first?.rate).toBeGreaterThan(1);
    expect(second?.mode).toBe('rate');
    expect(second?.syncedTime).toBeCloseTo(10, 6);
    expect(second?.rate).toBeGreaterThan(first?.rate ?? 1);
    expect(syncExternalTime).not.toHaveBeenCalled();
    expect(setRate).toHaveBeenCalledTimes(2);
    expect(setRate.mock.lastCall?.[0]).toBeCloseTo(second?.rate ?? 1, 6);
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

    expect(forward).toMatchObject({ mode: 'hard', syncedTime: 10.75, state: 'locked-hard' });
    expect(backward).toMatchObject({ mode: 'hard', syncedTime: 9.9, state: 'locked-hard' });
    expect(forward?.reason).toBe('hard-resync');
    expect(backward?.reason).toBe('rewind-detect');
    expect(backward?.sequence).toBeGreaterThan(forward?.sequence ?? 0);
    expect(setRate).toHaveBeenNthCalledWith(1, 1);
    expect(setRate).toHaveBeenNthCalledWith(2, 1);
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
    expect(diagnostics.lastSequence).toBe(1);
    expect(diagnostics.lastSyncReason).toBe('idle');
  });

  it('keeps deadband samples passive when there is no seek-style confirmation', () => {
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
    const steady = transport.ingestTime(10.004, 1033);

    expect(steady).toMatchObject({ reason: 'deadband', mode: 'soft', syncedTime: 10 });
    expect(syncExternalTime).not.toHaveBeenCalled();
  });

  it('keeps monotonic sequence through seek-style confirmation and soft chase', () => {
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
      { lockFrames: 1, deadbandSec: 0.01 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    currentTime = 12;
    const confirmed = transport.ingestTime(12.005, 1033);
    const chased = transport.ingestTime(12.04, 1066);

    expect(confirmed).toMatchObject({ reason: 'seek-confirm', mode: 'soft' });
    expect(chased).toMatchObject({ reason: 'soft-chase', mode: 'rate' });
    expect(setRate).toHaveBeenCalledTimes(1);
    expect((chased?.sequence ?? 0)).toBeGreaterThan(confirmed?.sequence ?? 0);
    expect(transport.getDiagnostics(1100).lastSequence).toBe(chased?.sequence);
  });

  it('records drift diagnostics and pll history under micro jitter', () => {
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
      { lockFrames: 1, hardResyncThreshold: 0.5, rewindThreshold: 0.1 },
    );

    expect(transport.ingestTime(10.0, 1000)).toBeNull();
    const samples = [10.033, 10.066, 10.099, 10.132, 10.165].map((time, index) => {
      currentTime = time - 0.001 + (index % 2 === 0 ? 0.0005 : -0.0005);
      return transport.ingestTime(time, 1033 + index * 33);
    });

    const diagnostics = transport.getDriftDiagnostics();
    expect(samples.every((sample) => sample?.mode !== 'hard')).toBe(true);
    expect(diagnostics.rate).toBeGreaterThan(0.98);
    expect(diagnostics.rate).toBeLessThan(1.02);
    expect(Math.abs(diagnostics.avgDriftSec)).toBeLessThan(0.001);
    expect(diagnostics.peakDriftSec).toBeGreaterThan(0);
    expect(transport.getPLLHistory().length).toBe(5);
  });

  it('hard resyncs once on drop-frame style gap and recovers lock', () => {
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
      { lockFrames: 1, hardResyncThreshold: 0.08 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    expect(transport.ingestTime(10.033, 1033)?.mode).toBe('rate');
    currentTime = 10.033;
    const hard = transport.ingestTime(10.2, 1183);
    currentTime = 10.2;
    const recovered = transport.ingestTime(10.233, 1216);

    expect(hard).toMatchObject({ mode: 'hard', rate: 1, reason: 'hard-resync' });
    expect(recovered?.state).toBe('locked-soft');
    expect(setRate).toHaveBeenCalledWith(1);
    expect(syncExternalTime).toHaveBeenCalledTimes(1);
  });

  it('resets pll integrator and rate on rewind hard sync', () => {
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
    currentTime = 10.01;
    transport.ingestTime(10.033, 1033);
    currentTime = 11;
    transport.ingestTime(12, 1066);
    const rewind = transport.ingestTime(5, 1099);
    const diagnostics = transport.getDriftDiagnostics();

    expect(rewind).toMatchObject({ mode: 'hard', rate: 1, reason: 'rewind-detect' });
    expect(diagnostics.rate).toBe(1);
    expect(diagnostics.integral).toBe(0);
  });

  it('converges slow drift using rate without moving position directly', () => {
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
      { lockFrames: 1, hardResyncThreshold: 0.5 },
    );

    expect(transport.ingestTime(10, 1000)).toBeNull();
    for (let frame = 1; frame <= 6; frame += 1) {
      currentTime += 1 / 30;
      transport.ingestTime(10 + frame / 30 + frame * 0.03, 1000 + frame * 33);
    }

    const diagnostics = transport.getDriftDiagnostics();
    expect(setRate).toHaveBeenCalled();
    expect(diagnostics.rate).not.toBe(1);
    expect(syncExternalTime).not.toHaveBeenCalled();
    expect(Math.abs(diagnostics.avgDriftSec)).toBeLessThan(diagnostics.peakDriftSec);
  });

  it('switches active source deterministically with hard sync fallback', () => {
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
      { lockFrames: 1 },
    );

    expect(transport.ingestTime(10, 1000, 'A', 1)).toBeNull();
    currentTime = 10.033;
    transport.ingestTime(10.033, 1033, 'A', 1);
    currentTime = 10.2;
    const switched = transport.ingestTime(10.2, 1034, 'B', 0);
    const diagnostics = transport.getDiagnostics(1040);

    expect(switched).toMatchObject({ mode: 'hard', reason: 'hard-resync' });
    expect(diagnostics.activeSource).toBe('B');
    expect(diagnostics.sourceCount).toBe(2);
    expect(syncExternalTime).toHaveBeenCalled();
  });

  it('tracks detected fps from incoming frame cadence', () => {
    const transport = new LTCTransport({
      getTime: () => 0,
      syncExternalTime: () => {},
    }, { lockFrames: 1 });

    expect(transport.ingestTime(0, 1000, 'A')).toBeNull();
    transport.ingestTime(1 / 24, 1042, 'A');
    transport.ingestTime(2 / 24, 1084, 'A');
    transport.ingestTime(3 / 24, 1126, 'A');

    expect(transport.getDriftDiagnostics().fps).toBeGreaterThan(28);
    expect(transport.getDiagnostics(1126).detectedFps).toBeGreaterThan(28);
  });

  it('emits deterministic source-switch hard-sync and rate-change events', () => {
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: (time) => { currentTime = time; },
      setRate,
    }, { lockFrames: 1 });

    expect(transport.ingestTime(10, 1000, 'A', 1)).toBeNull();
    currentTime = 10.033;
    transport.ingestTime(10.033, 1033, 'A', 1);
    currentTime = 10;
    transport.ingestTime(10.066, 1066, 'A', 1);
    currentTime = 10.2;
    transport.ingestTime(10.2, 1034, 'B', 0);

    const events = transport.getEvents();
    expect(events.some((event) => event.type === 'source-switch')).toBe(true);
    expect(events.some((event) => event.type === 'hard-sync')).toBe(true);
    expect(events.some((event) => event.type === 'rate-change')).toBe(true);
  });

  it('exports drift series and can replay the recorded transport stream', () => {
    const setRate = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: (time) => { currentTime = time; },
      setRate,
    }, { lockFrames: 1 });

    expect(transport.ingestTime(10, 1000, 'A', 1)).toBeNull();
    currentTime = 10.03;
    transport.ingestTime(10.033, 1033, 'A', 1);
    currentTime = 10.06;
    transport.ingestTime(10.066, 1066, 'A', 1);

    const series = transport.getDriftSeries();
    const record = transport.getReplayRecord();
    expect(series.drift.length).toBe(series.time.length);
    expect(record.length).toBeGreaterThan(0);

    transport.replay(record);
    expect(transport.getReplayRecord().length).toBe(record.length);
  });
});