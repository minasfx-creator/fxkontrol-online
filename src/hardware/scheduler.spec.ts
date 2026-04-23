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
});