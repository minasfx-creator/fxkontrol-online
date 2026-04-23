import { describe, expect, it, vi } from 'vitest';
import { LTCTransport } from './ltc';

describe('LTCTransport', () => {
  it('softens jitter instead of snapping on small chase corrections', () => {
    const syncExternalTime = vi.fn();
    const transport = new LTCTransport(
      {
        getTime: () => 10,
        syncExternalTime,
      },
      { smoothingFactor: 0.15 },
    );

    const first = transport.ingestTime(10.033, 1000);
    const second = transport.ingestTime(10.04, 1033);

    expect(first).toMatchObject({ mode: 'soft', syncedTime: 10.033 });
    expect(second?.mode).toBe('soft');
    expect(second?.syncedTime).toBeCloseTo(10.03405, 6);
    expect(syncExternalTime).toHaveBeenCalledTimes(2);
    expect(syncExternalTime).toHaveBeenLastCalledWith(10.03405);
  });

  it('snaps immediately on large forward and backward jumps', () => {
    const syncExternalTime = vi.fn();
    let currentTime = 10;
    const transport = new LTCTransport({
      getTime: () => currentTime,
      syncExternalTime: (time) => {
        currentTime = time;
        syncExternalTime(time);
      },
    });

    const forward = transport.ingestTime(10.75, 1000);
    const backward = transport.ingestTime(9.9, 1033);

    expect(forward).toMatchObject({ mode: 'snap', syncedTime: 10.75 });
    expect(backward).toMatchObject({ mode: 'snap', syncedTime: 9.9 });
    expect(syncExternalTime).toHaveBeenNthCalledWith(1, 10.75);
    expect(syncExternalTime).toHaveBeenNthCalledWith(2, 9.9);
  });

  it('ignores deadband jitter and tracks pause/resume signal presence', () => {
    const syncExternalTime = vi.fn();
    const transport = new LTCTransport(
      {
        getTime: () => 10,
        syncExternalTime,
      },
      { pauseTimeoutMs: 250 },
    );

    const ignored = transport.ingestTime(10.01, 1000);

    expect(ignored).toMatchObject({ mode: 'ignore', syncedTime: 10 });
    expect(syncExternalTime).not.toHaveBeenCalled();
    expect(transport.isSignalPresent(1200)).toBe(true);
    expect(transport.isSignalPresent(1301)).toBe(false);

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
  });
});