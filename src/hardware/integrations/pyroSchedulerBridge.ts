import type { ShowPlan } from '@/core/showplan/ShowPlan';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { safetyStateMachine, type SafetyState } from '@/core/safety/SafetyStateMachine';
import type { TimelineClockState } from '@/core/timeline/TimelineClock';
import {
  HardwareScheduler,
  type HardwareSchedulerSnapshot,
  type ScheduledHardwareEvent,
} from '@/hardware/scheduler';
import {
  PYRO_USB_DEFAULT_LATENCY_MS,
  PyroUsbTransport,
  pyroUsbTransport,
  type PyroUsbScheduledPayload,
} from '@/hardware/transports/pyroUsb';

export type PyroSchedulerRebuildReason =
  | 'boot'
  | 'play'
  | 'seek-forward'
  | 'rewind'
  | 'external-sync'
  | 'showplan-change'
  | 'reset';

export interface PyroSchedulerBridgeDiagnostics {
  currentClockTime: number;
  pendingCount: number;
  nextPyroDispatchTime: number | null;
  lastScheduledCueId: string | null;
  lastFiredCueId: string | null;
  lastRebuildReason: PyroSchedulerRebuildReason;
  transportConnected: boolean;
  safetyState: SafetyState;
  lastBlockedReason: string | null;
  scheduler: HardwareSchedulerSnapshot<ScheduledHardwareEvent<PyroUsbScheduledPayload>>;
}

export interface PyroSchedulerBridgeOptions {
  transport?: PyroUsbTransport;
  getShowPlan?: () => Readonly<ShowPlan>;
  getSafetyState?: () => SafetyState;
  nowMs?: () => number;
  jumpThresholdSec?: number;
}

const EPSILON = 1e-6;
const DEFAULT_JUMP_THRESHOLD_SEC = 0.25;

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  Object.freeze(value);

  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === 'object') {
      deepFreeze(nested);
    }
  }

  return value as Readonly<T>;
}

export class PyroSchedulerBridge {
  private readonly transport: PyroUsbTransport;
  private readonly getShowPlan: () => Readonly<ShowPlan>;
  private readonly getSafetyState: () => SafetyState;
  private readonly nowMs: () => number;
  private readonly jumpThresholdSec: number;
  private readonly scheduler: HardwareScheduler<ScheduledHardwareEvent<PyroUsbScheduledPayload>>;
  private lastClockState: TimelineClockState | null = null;
  private lastShowPlanSignature = '';
  private lastScheduledCueId: string | null = null;
  private lastFiredCueId: string | null = null;
  private lastRebuildReason: PyroSchedulerRebuildReason = 'boot';
  private lastBlockedReason: string | null = null;
  private pendingDispatch = Promise.resolve();

  constructor(options: PyroSchedulerBridgeOptions = {}) {
    this.transport = options.transport ?? pyroUsbTransport;
    this.getShowPlan = options.getShowPlan ?? (() => showPlanManager.current);
    this.getSafetyState = options.getSafetyState ?? (() => safetyStateMachine.state);
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.jumpThresholdSec = options.jumpThresholdSec ?? DEFAULT_JUMP_THRESHOLD_SEC;

    this.scheduler = new HardwareScheduler(
      {
        dispatch: (event) => {
          this.pendingDispatch = this.pendingDispatch.then(() => this.dispatchScheduledEvent(event));
        },
      },
      {
        latencyByType: { pyro: PYRO_USB_DEFAULT_LATENCY_MS },
      },
    );
  }

  tick(clockState: TimelineClockState): void {
    const showPlan = this.getShowPlan();
    const signature = this.getPlanSignature(showPlan);

    if (signature !== this.lastShowPlanSignature) {
      this.rebuildQueue(showPlan, clockState.time, this.lastClockState ? 'showplan-change' : 'boot');
      this.lastShowPlanSignature = signature;
    }

    if (!this.lastClockState) {
      this.lastClockState = { ...clockState };
      return;
    }

    const previous = this.lastClockState;
    const delta = clockState.time - previous.time;
    const changedTime = Math.abs(delta) > EPSILON;
    const isJump = Math.abs(delta) > this.jumpThresholdSec;
    const externalReposition = clockState.lastPositionChange === 'external-sync'
      || clockState.lastPositionChange === 'external-confirm';

    if (changedTime && (externalReposition || delta < 0 || isJump)) {
      if (delta < 0) {
        this.rebuildQueue(showPlan, clockState.time, 'rewind');
      } else if (externalReposition) {
        this.rebuildQueue(showPlan, clockState.time, 'external-sync');
      } else {
        this.scheduler.seek(clockState.time);
        this.lastRebuildReason = 'seek-forward';
      }
    } else if (!previous.playing && clockState.playing && this.lastRebuildReason === 'boot') {
      this.lastRebuildReason = 'play';
    }

    this.lastClockState = { ...clockState };

    if (!clockState.playing || delta <= EPSILON) {
      return;
    }

    this.scheduler.tick(delta);
  }

  reset(): void {
    this.scheduler.reset(0);
    this.lastClockState = null;
    this.lastShowPlanSignature = '';
    this.lastScheduledCueId = null;
    this.lastFiredCueId = null;
    this.lastBlockedReason = null;
    this.lastRebuildReason = 'reset';
  }

  getDiagnostics(): Readonly<PyroSchedulerBridgeDiagnostics> {
    const schedulerDiagnostics = this.scheduler.getDiagnostics();

    return deepFreeze({
      currentClockTime: this.lastClockState?.time ?? schedulerDiagnostics.now,
      pendingCount: this.scheduler.getPendingCount(),
      nextPyroDispatchTime: schedulerDiagnostics.nextDispatchTime,
      lastScheduledCueId: this.lastScheduledCueId,
      lastFiredCueId: this.lastFiredCueId,
      lastRebuildReason: this.lastRebuildReason,
      transportConnected: this.transport.isConnected(),
      safetyState: this.getSafetyState(),
      lastBlockedReason: this.lastBlockedReason,
      scheduler: schedulerDiagnostics,
    });
  }

  async flushPending(): Promise<void> {
    await this.pendingDispatch;
  }

  private rebuildQueue(plan: Readonly<ShowPlan>, fromTime: number, reason: PyroSchedulerRebuildReason): void {
    this.scheduler.reset(fromTime);
    this.lastScheduledCueId = null;
    this.lastBlockedReason = null;

    const cues = [...plan.pyroCues].sort((a, b) => a.time - b.time);
    for (const cue of cues) {
      const scheduledTime = Math.max(0, cue.time - cue.fuseDelay / 1000);
      if (scheduledTime + EPSILON < fromTime) {
        continue;
      }

      this.scheduler.schedule({
        id: cue.id,
        t: scheduledTime,
        type: 'pyro',
        payload: {
          command: 'fire',
          moduleAddress: cue.module + 1,
          cueIndex: cue.channel,
        },
      });
      this.lastScheduledCueId = cue.id;
    }

    this.lastRebuildReason = reason;
  }

  private async dispatchScheduledEvent(event: ScheduledHardwareEvent<PyroUsbScheduledPayload>): Promise<void> {
    const payload = event.payload;
    if (!payload || payload.command !== 'fire') {
      return;
    }

    const blockedReason = await this.getBlockedReason(payload);
    if (blockedReason) {
      this.lastBlockedReason = blockedReason;
      return;
    }

    await this.transport.dispatch(payload, this.nowMs());
    this.lastBlockedReason = null;
    this.lastFiredCueId = event.id ?? null;
  }

  private async getBlockedReason(payload: Extract<PyroUsbScheduledPayload, { command: 'fire' }>): Promise<string | null> {
    const watchdogTripped = await this.transport.serviceWatchdog(this.nowMs());
    if (watchdogTripped) {
      return 'watchdog expired';
    }

    if (!this.transport.isConnected()) {
      return 'transport disconnected';
    }

    const transportDiagnostics = this.transport.getDiagnostics(this.nowMs());
    if (transportDiagnostics.lockoutReason || transportDiagnostics.state === 'lockout' || transportDiagnostics.state === 'fault') {
      return `transport ${transportDiagnostics.state}`;
    }

    if (!this.transport.isModuleArmed(payload.moduleAddress)) {
      return `module ${payload.moduleAddress} not armed`;
    }

    const safetyState = this.getSafetyState();
    if (safetyState !== 'ARMED' && safetyState !== 'FIRING') {
      return `safety ${safetyState}`;
    }

    return null;
  }

  private getPlanSignature(plan: Readonly<ShowPlan>): string {
    return `${plan.metadata.id}:${plan.metadata.updatedAt}:${plan.pyroCues.length}`;
  }
}

export const pyroSchedulerBridge = new PyroSchedulerBridge();