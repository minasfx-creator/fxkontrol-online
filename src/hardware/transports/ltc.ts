import { resolveSMPTEChase, type SMPTEChaseOptions, type SMPTEChaseResult } from '@/core/timeline/smpteChase';

export interface LTCSyncTarget {
  getTime: () => number;
  syncExternalTime: (time: number) => void;
}

export interface LTCTransportOptions {
  smoothingFactor?: number;
  pauseTimeoutMs?: number;
  chase?: SMPTEChaseOptions;
}

export interface LTCSyncSample {
  incomingTime: number;
  syncedTime: number;
  driftSec: number;
  mode: SMPTEChaseResult['mode'];
}

export interface LTCTransportDiagnostics {
  signalPresent: boolean;
  lastIncomingTime: number | null;
  lastSyncedTime: number | null;
  lastSignalAt: number | null;
  lastDriftSec: number;
  lastMode: SMPTEChaseResult['mode'] | 'idle';
  smoothingFactor: number;
  pauseTimeoutMs: number;
}

const DEFAULT_OPTIONS: Required<LTCTransportOptions> = {
  smoothingFactor: 0.15,
  pauseTimeoutMs: 250,
  chase: {},
};

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

export class LTCTransport {
  private readonly options: Required<LTCTransportOptions>;
  private lastIncomingTime: number | null = null;
  private lastSyncedTime: number | null = null;
  private lastSignalAt: number | null = null;
  private lastDriftSec = 0;
  private lastMode: SMPTEChaseResult['mode'] | 'idle' = 'idle';

  constructor(
    private readonly target: LTCSyncTarget,
    options: LTCTransportOptions = {},
  ) {
    this.options = {
      smoothingFactor: options.smoothingFactor ?? DEFAULT_OPTIONS.smoothingFactor,
      pauseTimeoutMs: options.pauseTimeoutMs ?? DEFAULT_OPTIONS.pauseTimeoutMs,
      chase: options.chase ?? DEFAULT_OPTIONS.chase,
    };
  }

  ingestTime(seconds: number, receivedAtMs = Date.now()): LTCSyncSample | null {
    if (!Number.isFinite(seconds) || !Number.isFinite(receivedAtMs)) {
      return null;
    }

    const chase = resolveSMPTEChase(this.target.getTime(), seconds, this.options.chase);

    this.lastIncomingTime = seconds;
    this.lastSignalAt = receivedAtMs;
    this.lastDriftSec = chase.driftSec;
    this.lastMode = chase.mode;

    if (chase.mode === 'ignore') {
      return {
        incomingTime: seconds,
        syncedTime: this.target.getTime(),
        driftSec: chase.driftSec,
        mode: chase.mode,
      };
    }

    const syncedTime = chase.mode === 'soft'
      ? this.smoothTime(chase.nextTime)
      : chase.nextTime;

    this.lastSyncedTime = syncedTime;
    this.target.syncExternalTime(syncedTime);

    return {
      incomingTime: seconds,
      syncedTime,
      driftSec: chase.driftSec,
      mode: chase.mode,
    };
  }

  isSignalPresent(nowMs = Date.now()): boolean {
    return this.lastSignalAt !== null && Number.isFinite(nowMs)
      ? nowMs - this.lastSignalAt <= this.options.pauseTimeoutMs
      : false;
  }

  reset(): void {
    this.lastIncomingTime = null;
    this.lastSyncedTime = null;
    this.lastSignalAt = null;
    this.lastDriftSec = 0;
    this.lastMode = 'idle';
  }

  getDiagnostics(nowMs = Date.now()): Readonly<LTCTransportDiagnostics> {
    return deepFreeze({
      signalPresent: this.isSignalPresent(nowMs),
      lastIncomingTime: this.lastIncomingTime,
      lastSyncedTime: this.lastSyncedTime,
      lastSignalAt: this.lastSignalAt,
      lastDriftSec: this.lastDriftSec,
      lastMode: this.lastMode,
      smoothingFactor: this.options.smoothingFactor,
      pauseTimeoutMs: this.options.pauseTimeoutMs,
    });
  }

  private smoothTime(nextTime: number): number {
    if (this.lastSyncedTime === null) {
      return nextTime;
    }

    return this.lastSyncedTime + (nextTime - this.lastSyncedTime) * this.options.smoothingFactor;
  }
}

export const createTimelineClockLTCTarget = (target: LTCSyncTarget): LTCSyncTarget => target;