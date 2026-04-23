import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARTNET_DEFAULT_LATENCY_MS,
  ArtNetTransport,
  type ArtNetScheduledPayload,
} from './transports/artnet';
import {
  HardwareScheduler,
  type ScheduledHardwareEvent,
  type SchedulerDispatchTarget,
} from './scheduler';
import { artNetBridge } from '@/core/protocols/ArtNetBridge';

describe('HardwareScheduler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches events in temporal order with latency compensation', () => {
    const dispatched: string[] = [];
    const target: SchedulerDispatchTarget<ScheduledHardwareEvent<{ name: string }>> = {
      dispatch: (event) => dispatched.push(event.payload?.name ?? 'unknown'),
    };

    const scheduler = new HardwareScheduler(target, {
      latencyByType: { dmx: ARTNET_DEFAULT_LATENCY_MS },
    });

    scheduler.schedule({ t: 12, type: 'dmx', payload: { name: 'dmx' } });
    scheduler.schedule({ t: 12.002, type: 'pyro', payload: { name: 'pyro' } });

    expect(scheduler.tick(11.991)).toBe(0);
    expect(scheduler.tick(0.002)).toBe(1);
    expect(dispatched).toEqual(['dmx']);

    expect(scheduler.tick(0.009)).toBe(1);
    expect(dispatched).toEqual(['dmx', 'pyro']);
  });

  it('flushes once after a dispatch batch and ignores invalid dt', () => {
    const target = {
      dispatch: vi.fn(),
      flush: vi.fn(),
    } satisfies SchedulerDispatchTarget;

    const scheduler = new HardwareScheduler(target);
    scheduler.schedule({ t: 1, type: 'dmx' });
    scheduler.schedule({ t: 1, type: 'laser' });

    expect(scheduler.tick(Number.NaN)).toBe(0);
    expect(scheduler.tick(-1)).toBe(0);
    expect(target.dispatch).not.toHaveBeenCalled();

    expect(scheduler.tick(1)).toBe(2);
    expect(target.dispatch).toHaveBeenCalledTimes(2);
    expect(target.flush).toHaveBeenCalledTimes(1);
  });

  it('returns a deep-frozen diagnostics snapshot', () => {
    const scheduler = new HardwareScheduler({ dispatch: () => {} });
    scheduler.schedule({
      t: 2,
      type: 'dmx',
      payload: { nested: { value: 1 } },
    });

    const diagnostics = scheduler.getDiagnostics() as unknown as {
      queue: ReadonlyArray<{ payload?: { nested?: { value: number } } }>;
    };

    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(Object.isFrozen(diagnostics.queue)).toBe(true);
    expect(Object.isFrozen(diagnostics.queue[0])).toBe(true);
    expect(Object.isFrozen(diagnostics.queue[0].payload)).toBe(true);
    expect(Object.isFrozen(diagnostics.queue[0].payload?.nested)).toBe(true);
  });

  it('prunes past events on seek while keeping future dispatches stable', () => {
    const dispatch = vi.fn();
    const scheduler = new HardwareScheduler({ dispatch });

    scheduler.schedule({ t: 1, type: 'dmx' });
    scheduler.schedule({ t: 2, type: 'pyro' });
    scheduler.schedule({ t: 3, type: 'laser' });

    scheduler.seek(2.1);

    expect(scheduler.getPendingCount()).toBe(1);
    expect(scheduler.getDiagnostics().nextEventTime).toBe(3);
    expect(scheduler.tick(0.89)).toBe(0);
    expect(scheduler.tick(0.01)).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ t: 3, type: 'laser' }), 3);
  });

  it('throws when the scheduler queue exceeds the safety cap', () => {
    const scheduler = new HardwareScheduler({ dispatch: () => {} });

    for (let i = 0; i < 10_000; i++) {
      scheduler.schedule({ t: i + 1, type: 'dmx' });
    }

    expect(() => scheduler.schedule({ t: 10_001, type: 'dmx' })).toThrow(
      'HardwareScheduler queue overflow',
    );
  });
});

describe('ArtNetTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds and flushes aggregated universe frames', () => {
    const sendDmx = vi.spyOn(artNetBridge, 'sendDmx').mockImplementation(() => {});
    const transport = new ArtNetTransport();

    const scheduler = new HardwareScheduler<ScheduledHardwareEvent<ArtNetScheduledPayload>>(
      {
        dispatch: (event) => {
          if (event.type === 'dmx' && event.payload) {
            transport.enqueue(event.payload);
          }
        },
        flush: () => {
          transport.flush();
        },
      },
      {
        latencyByType: { dmx: ARTNET_DEFAULT_LATENCY_MS },
      },
    );

    scheduler.schedule({
      t: 12,
      type: 'dmx',
      payload: { universe: 0, updates: [{ channel: 1, value: 255 }] },
    });
    scheduler.schedule({
      t: 12,
      type: 'dmx',
      payload: { universe: 0, updates: [{ channel: 2, value: 127 }] },
    });

    scheduler.tick(11.992);

    expect(sendDmx).toHaveBeenCalledTimes(1);
    expect(sendDmx).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        0: 255,
        1: 127,
      }),
    );
  });

  it('ignores invalid universe ids', () => {
    const sendDmx = vi.spyOn(artNetBridge, 'sendDmx').mockImplementation(() => {});
    const transport = new ArtNetTransport();

    transport.enqueue({ universe: -1, updates: [{ channel: 1, value: 255 }] });
    transport.enqueue({ universe: 32768, updates: [{ channel: 1, value: 255 }] });

    const stats = transport.flush();

    expect(stats.sentUniverses).toBe(0);
    expect(stats.dirtyUniverses).toBe(0);
    expect(sendDmx).not.toHaveBeenCalled();
  });
});