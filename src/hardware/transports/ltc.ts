export interface LTCSyncTarget {
  getTime: () => number;
  syncExternalTime: (time: number) => void;
  releaseExternalSync?: () => void;
  getRate?: () => number;
  setRate?: (rate: number) => void;
}

export interface LTCTransportOptions {
  smoothingFactor: number;
  deadbandSec: number;
  pauseTimeoutMs: number;
  lockFrames: number;
  unlockFrames: number;
  maxCorrectionPerFrame: number;
  hardResyncThreshold: number;
  rewindThreshold: number;
}

export type LTCSyncMode = 'soft' | 'hard' | 'rate';

export type LTCState = 'idle' | 'locking' | 'locked-soft' | 'locked-hard' | 'lost';

export interface LTCSyncSample {
  incomingTime: number;
  syncedTime: number;
  driftSec: number;
  mode: LTCSyncMode;
  rate?: number;
  state: LTCState;
  sequence: number;
  reason: 'soft-chase' | 'deadband' | 'hard-resync' | 'rewind-detect' | 'seek-confirm';
}

export interface LTCTransportDiagnostics {
  signalPresent: boolean;
  lastIncomingTime: number | null;
  lastSyncedTime: number | null;
  lastSignalAt: number | null;
  lastDriftSec: number;
  lastMode: LTCSyncMode | 'idle';
  lastSequence: number;
  lastSyncReason: LTCSyncSample['reason'] | 'idle';
  state: LTCState;
  locked: boolean;
  lockCounter: number;
  unlockCounter: number;
  smoothingFactor: number;
  currentRate: number;
  rateIntegral: number;
  deadbandSec: number;
  pauseTimeoutMs: number;
  lockFrames: number;
  unlockFrames: number;
  maxCorrectionPerFrame: number;
  hardResyncThreshold: number;
  rewindThreshold: number;
}

const DEFAULT_OPTIONS: Required<LTCTransportOptions> = {
  smoothingFactor: 0.15,
  deadbandSec: 0.002,
  pauseTimeoutMs: 250,
  lockFrames: 3,
  unlockFrames: 3,
  maxCorrectionPerFrame: 0.04,
  hardResyncThreshold: 0.5,
  rewindThreshold: 0.1,
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
  private readonly options: LTCTransportOptions;
  private lastIncomingTime: number | null = null;
  private lastSyncedTime: number | null = null;
  private lastSignalAt: number | null = null;
  private lastDriftSec = 0;
  private lastMode: LTCSyncMode | 'idle' = 'idle';
  private state: LTCState = 'idle';
  private lockCounter = 0;
  private unlockCounter = 0;
  private locked = false;
  private sequence = 0;
  private lastSyncReason: LTCSyncSample['reason'] | 'idle' = 'idle';
  private rate = 1;
  private rateIntegral = 0;

  constructor(
    private readonly target: LTCSyncTarget,
    options: Partial<LTCTransportOptions> = {},
  ) {
    this.options = {
      smoothingFactor: options.smoothingFactor ?? DEFAULT_OPTIONS.smoothingFactor,
      deadbandSec: options.deadbandSec ?? DEFAULT_OPTIONS.deadbandSec,
      pauseTimeoutMs: options.pauseTimeoutMs ?? DEFAULT_OPTIONS.pauseTimeoutMs,
      lockFrames: options.lockFrames ?? DEFAULT_OPTIONS.lockFrames,
      unlockFrames: options.unlockFrames ?? DEFAULT_OPTIONS.unlockFrames,
      maxCorrectionPerFrame: options.maxCorrectionPerFrame ?? DEFAULT_OPTIONS.maxCorrectionPerFrame,
      hardResyncThreshold: options.hardResyncThreshold ?? DEFAULT_OPTIONS.hardResyncThreshold,
      rewindThreshold: options.rewindThreshold ?? DEFAULT_OPTIONS.rewindThreshold,
    };
  }

  ingestTime(seconds: number, receivedAtMs = Date.now()): LTCSyncSample | null {
    if (!Number.isFinite(seconds) || !Number.isFinite(receivedAtMs)) {
      return null;
    }

    const previousIncomingTime = this.lastIncomingTime;
    this.lastIncomingTime = seconds;
    this.lastSignalAt = receivedAtMs;
    this.sequence += 1;

    if (!this.locked) {
      this.unlockCounter = 0;
      this.lockCounter += 1;

      if (this.lockCounter >= this.options.lockFrames) {
        this.locked = true;
      }

      this.state = 'locking';
      return null;
    }

    this.lockCounter = 0;
    this.unlockCounter = 0;

    const current = this.target.getTime();
    const delta = seconds - current;

    this.lastDriftSec = delta;

    if (delta < -this.options.rewindThreshold || Math.abs(delta) > this.options.hardResyncThreshold) {
      this.state = 'locked-hard';
      this.lastMode = 'hard';
      this.lastSyncedTime = seconds;
      this.lastSyncReason = delta < -this.options.rewindThreshold ? 'rewind-detect' : 'hard-resync';
      this.rate = 1;
      this.rateIntegral = 0;
      this.target.setRate?.(1);
      this.target.syncExternalTime(seconds);

      return {
        incomingTime: seconds,
        syncedTime: seconds,
        driftSec: delta,
        mode: 'hard',
        rate: 1,
        state: this.state,
        sequence: this.sequence,
        reason: this.lastSyncReason,
      };
    }

    if (Math.abs(delta) < this.options.deadbandSec) {
      const seekConfirmed = previousIncomingTime !== null && Math.abs(current - previousIncomingTime) > this.options.deadbandSec;
      this.state = 'locked-soft';
      this.lastMode = 'soft';
      this.lastSyncedTime = current;
      this.lastSyncReason = seekConfirmed ? 'seek-confirm' : 'deadband';

      if (seekConfirmed) {
        this.target.syncExternalTime(current);
      }

      return {
        incomingTime: seconds,
        syncedTime: current,
        driftSec: delta,
        mode: 'soft',
        rate: this.rate,
        state: this.state,
        sequence: this.sequence,
        reason: this.lastSyncReason,
      };
    }

    const clampedDelta = Math.max(
      -this.options.maxCorrectionPerFrame,
      Math.min(this.options.maxCorrectionPerFrame, delta),
    );

    const drift = seconds - current;
    const kp = this.options.smoothingFactor;
    const ki = 0.02;

    this.rateIntegral += drift * ki;
    this.rate = 1 + drift * kp + this.rateIntegral;
    this.rate = Math.max(0.98, Math.min(1.02, this.rate));

    this.lastSyncedTime = current;
    this.lastMode = 'rate';
    this.state = 'locked-soft';
    this.lastSyncReason = 'soft-chase';
    this.target.setRate?.(this.rate);

    return {
      incomingTime: seconds,
      syncedTime: current,
      driftSec: delta,
      mode: 'rate',
      rate: this.rate,
      state: this.state,
      sequence: this.sequence,
      reason: this.lastSyncReason,
    };
  }

  isSignalPresent(nowMs = Date.now()): boolean {
    const present = this.lastSignalAt !== null && Number.isFinite(nowMs)
      ? nowMs - this.lastSignalAt <= this.options.pauseTimeoutMs
      : false;

    if (!present) {
      this.lockCounter = 0;
      this.unlockCounter += 1;

      if (this.unlockCounter >= this.options.unlockFrames && this.locked) {
        this.locked = false;
        this.state = 'lost';
        this.lastMode = 'idle';
        this.target.releaseExternalSync?.();
      }
    } else {
      this.unlockCounter = 0;
    }

    return present;
  }

  reset(): void {
    this.lastIncomingTime = null;
    this.lastSyncedTime = null;
    this.lastSignalAt = null;
    this.lastDriftSec = 0;
    this.lastMode = 'idle';
    this.sequence = 0;
    this.lastSyncReason = 'idle';
    this.rate = 1;
    this.rateIntegral = 0;
    this.state = 'idle';
    this.lockCounter = 0;
    this.unlockCounter = 0;
    this.locked = false;
  }

  getDiagnostics(nowMs = Date.now()): Readonly<LTCTransportDiagnostics> {
    return deepFreeze({
      signalPresent: this.isSignalPresent(nowMs),
      lastIncomingTime: this.lastIncomingTime,
      lastSyncedTime: this.lastSyncedTime,
      lastSignalAt: this.lastSignalAt,
      lastDriftSec: this.lastDriftSec,
      lastMode: this.lastMode,
      lastSequence: this.sequence,
      lastSyncReason: this.lastSyncReason,
      state: this.state,
      locked: this.locked,
      lockCounter: this.lockCounter,
      unlockCounter: this.unlockCounter,
      smoothingFactor: this.options.smoothingFactor,
      currentRate: this.rate,
      rateIntegral: this.rateIntegral,
      deadbandSec: this.options.deadbandSec,
      pauseTimeoutMs: this.options.pauseTimeoutMs,
      lockFrames: this.options.lockFrames,
      unlockFrames: this.options.unlockFrames,
      maxCorrectionPerFrame: this.options.maxCorrectionPerFrame,
      hardResyncThreshold: this.options.hardResyncThreshold,
      rewindThreshold: this.options.rewindThreshold,
    });
  }

  getState(): LTCState {
    return this.state;
  }
}

export const createTimelineClockLTCTarget = (target: LTCSyncTarget): LTCSyncTarget => target;