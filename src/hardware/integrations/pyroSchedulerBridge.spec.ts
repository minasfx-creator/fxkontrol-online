import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import type { TimelineClockState } from '@/core/timeline/TimelineClock';
import { PyroSchedulerBridge } from './pyroSchedulerBridge';
import { PYRO_USB_DEFAULT_LATENCY_MS } from '@/hardware/transports/pyroUsb';

function createPlan(): ShowPlan {
  const plan = createEmptyShowPlan();
  plan.metadata.id = 'plan-1';
  plan.metadata.updatedAt = 1;
  plan.pyroCues = [
    {
      id: 'cue-1',
      time: 10,
      positionId: 'p1',
      module: 0,
      channel: 0,
      effectId: 'fx-1',
      fuseDelay: 100,
      caliber: 75,
      elevation: 90,
      heading: 0,
      position: { x: 0, y: 0, z: 0 },
    },
  ];
  return plan;
}

function createClockState(overrides: Partial<TimelineClockState> = {}): TimelineClockState {
  return {
    time: 0,
    playing: false,
    speed: 1,
    duration: 120,
    loop: false,
    source: 'local',
    lastExternalSync: null,
    driftSec: 0,
    externalSyncSequence: 0,
    positionSequence: 0,
    lastExternalTargetTime: null,
    lastPositionChange: 'init',
    ...overrides,
  };
}

function createTransportStub() {
  return {
    dispatch: vi.fn().mockResolvedValue(undefined),
    getDiagnostics: vi.fn(() => ({
      connectionState: 'bound',
      state: 'armed',
      lockoutReason: null,
      armedModules: [1],
      adapterType: 'fireone',
      lastCommandAt: null,
      lastArmAt: null,
      lastFireAt: null,
      lastWatchdogKickAt: null,
      watchdogTimeoutMs: 250,
      watchdogExpired: false,
    })),
    isConnected: vi.fn(() => true),
    isModuleArmed: vi.fn(() => true),
    serviceWatchdog: vi.fn().mockResolvedValue(false),
  };
}

describe('PyroSchedulerBridge', () => {
  let plan: ShowPlan;

  beforeEach(() => {
    plan = createPlan();
  });

  it('dispara cue com compensação de fuseDelay e latência do transporte', async () => {
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
      nowMs: () => 9_900,
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 9.887, playing: true }));
    await bridge.flushPending();
    expect(transport.dispatch).not.toHaveBeenCalled();

    bridge.tick(createClockState({ time: 9.889, playing: true }));
    await bridge.flushPending();

    expect(transport.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'fire', moduleAddress: 1, cueIndex: 0 }),
      9900,
    );
    expect(bridge.getDiagnostics().lastFiredCueId).toBe('cue-1');
    expect(PYRO_USB_DEFAULT_LATENCY_MS).toBe(12);
  });

  it('seek para frente poda cues perdidas sem retro-fire', async () => {
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 11, playing: false }));
    bridge.tick(createClockState({ time: 11.1, playing: true }));
    await bridge.flushPending();

    expect(transport.dispatch).not.toHaveBeenCalled();
    expect(bridge.getDiagnostics().lastRebuildReason).toBe('seek-forward');
  });

  it('rewind reconstrói a fila e permite replay determinístico', async () => {
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
      nowMs: () => 9_900,
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 0, playing: false }));
    bridge.tick(createClockState({ time: 10, playing: false }));
    bridge.tick(createClockState({ time: 0, playing: false }));
    bridge.tick(createClockState({ time: 9.889, playing: true }));
    await bridge.flushPending();

    expect(bridge.getDiagnostics().lastRebuildReason).toBe('rewind');
    expect(transport.dispatch).toHaveBeenCalledTimes(1);
  });

  it('pause não dispara', async () => {
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 12, playing: false }));
    await bridge.flushPending();

    expect(transport.dispatch).not.toHaveBeenCalled();
  });

  it('external sync não duplica firing', async () => {
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
      nowMs: () => 9_900,
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 9.889, playing: true }));
    await bridge.flushPending();
    bridge.tick(createClockState({ time: 9.889, playing: true, source: 'external', lastExternalSync: 1 }));
    await bridge.flushPending();

    expect(transport.dispatch).toHaveBeenCalledTimes(1);
  });

  it('bloqueia dispatch em watchdog, lockout, desarmado ou safety não armado', async () => {
    const transport = createTransportStub();
    transport.serviceWatchdog.mockResolvedValue(true);

    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'LOCKED',
      nowMs: () => 9_900,
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 9.889, playing: true }));
    await bridge.flushPending();

    expect(transport.dispatch).not.toHaveBeenCalled();
    expect(bridge.getDiagnostics().lastBlockedReason).toBe('watchdog expired');
  });

  it('preserva ordem estável para cues no mesmo timestamp', async () => {
    plan.pyroCues = [
      { ...plan.pyroCues[0], id: 'cue-a', module: 0, channel: 0, fuseDelay: 0, time: 10 },
      { ...plan.pyroCues[0], id: 'cue-b', module: 0, channel: 1, fuseDelay: 0, time: 10 },
      { ...plan.pyroCues[0], id: 'cue-c', module: 0, channel: 2, fuseDelay: 0, time: 10 },
    ];
    const transport = createTransportStub();
    const bridge = new PyroSchedulerBridge({
      transport: transport as never,
      getShowPlan: () => plan,
      getSafetyState: () => 'ARMED',
      nowMs: () => 10_000,
      jumpThresholdSec: 100,
    });

    bridge.tick(createClockState({ time: 0 }));
    bridge.tick(createClockState({ time: 10, playing: true }));
    await bridge.flushPending();

    expect(transport.dispatch.mock.calls.map(([payload]) => payload.cueIndex)).toEqual([0, 1, 2]);
  });
});