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
  avgDriftSec: number;
  peakDriftSec: number;
  detectedFps: number;
  activeSource: string | null;
  sourceCount: number;
  deadbandSec: number;
  pauseTimeoutMs: number;
  lockFrames: number;
  unlockFrames: number;
  maxCorrectionPerFrame: number;
  hardResyncThreshold: number;
  rewindThreshold: number;
}

export interface LTCDriftDiagnostics {
  driftSec: number;
  avgDriftSec: number;
  peakDriftSec: number;
  rate: number;
  integral: number;
  state: LTCState;
  fps?: number;
}

export type LTCEvent =
  | { type: 'source-switch'; from: string | null; to: string; time: number; sequence: number }
  | { type: 'hard-sync'; reason: LTCSyncSample['reason']; time: number; sequence: number }
  | { type: 'rate-change'; rate: number; time: number; sequence: number };

export interface LTCDriftSeries {
  drift: readonly number[];
  time: readonly number[];
}

export interface LTCReplayFrame {
  time: number;
  source: string;
  priority: number;
  incoming: number;
  diagnostics: LTCDriftDiagnostics & { source: string | null };
  sample: LTCSyncSample | null;
}

export interface LTCReplayOptions {
  speed?: number;
  step?: boolean;
  onFrame?: (frame: LTCReplayFrame, index: number, total: number) => void;
}

interface LTCSourceState {
  id: string;
  lastSeen: number;
  drift: number;
  priority: number;
  lastTime: number | null;
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
  private driftAvg = 0;
  private driftPeak = 0;
  private readonly driftAlpha = 0.05;
  private pllHistory = new Float32Array(120);
  private pllIndex = 0;
  private pllCount = 0;
  private detectedFps = 30;
  private activeSource: string | null = null;
  private readonly sources = new Map<string, LTCSourceState>();
  private historyTime = new Float32Array(120);
  private events: LTCEvent[] = [];
  private replayRecord: LTCReplayFrame[] = [];
  private replayCursor = 0;
  private replayTimer: ReturnType<typeof setTimeout> | null = null;
  private kalmanEnabled = false;
  private kalmanEstimate = 0;
  private kalmanError = 1;
  private eventSubscribers = new Set<(event: LTCEvent) => void>();

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

  ingestTime(seconds: number, receivedAtMs = Date.now(), sourceId = 'default', priority = 0): LTCSyncSample | null {
    if (!Number.isFinite(seconds) || !Number.isFinite(receivedAtMs)) {
      return null;
    }

    const source = this.upsertSource(sourceId, receivedAtMs, priority);
    const previousIncomingTime = source.lastTime;
    source.lastTime = seconds;
    const bestSource = this.selectBestSource(receivedAtMs);
    const sourceSwitch = bestSource !== null && bestSource.id !== this.activeSource;

    if (sourceSwitch) {
      const previousSource = this.activeSource;
      this.activeSource = bestSource?.id ?? null;
      if (this.activeSource) {
        this.pushEvent({ type: 'source-switch', from: previousSource, to: this.activeSource });
      }
    } else if (this.activeSource === null) {
      this.activeSource = source.id;
    }

    if (this.activeSource !== source.id) {
      return this.finishIngest(null, receivedAtMs, sourceId, priority, seconds);
    }

    this.lastIncomingTime = seconds;
    this.lastSignalAt = receivedAtMs;
    this.sequence += 1;

    this.updateDetectedFps(seconds, previousIncomingTime);

    if (!this.locked) {
      this.unlockCounter = 0;
      this.lockCounter += 1;

      if (this.lockCounter >= this.options.lockFrames) {
        this.locked = true;
      }

      this.state = 'locking';
      return this.finishIngest(null, receivedAtMs, sourceId, priority, seconds);
    }

    this.lockCounter = 0;
    this.unlockCounter = 0;

    const current = this.target.getTime();
    const delta = seconds - current;

    this.lastDriftSec = delta;
    source.drift = delta;
    this.recordDrift(delta);

    if (sourceSwitch || delta < -this.options.rewindThreshold || Math.abs(delta) > this.options.hardResyncThreshold) {
      this.state = 'locked-hard';
      this.lastMode = 'hard';
      this.lastSyncedTime = seconds;
      this.lastSyncReason = sourceSwitch
        ? 'hard-resync'
        : delta < -this.options.rewindThreshold
          ? 'rewind-detect'
          : 'hard-resync';
      this.rate = 1;
      this.rateIntegral = 0;
      this.pushEvent({ type: 'hard-sync', reason: this.lastSyncReason });
      this.target.setRate?.(1);
      this.target.syncExternalTime(seconds);

      return this.finishIngest({
        incomingTime: seconds,
        syncedTime: seconds,
        driftSec: delta,
        mode: 'hard',
        rate: 1,
        state: this.state,
        sequence: this.sequence,
        reason: this.lastSyncReason,
      }, receivedAtMs, sourceId, priority, seconds);
    }

    const deadbandSec = 0.5 / this.detectedFps;

    if (Math.abs(delta) < deadbandSec) {
      const seekConfirmed = previousIncomingTime !== null && Math.abs(current - previousIncomingTime) > deadbandSec;
      this.state = 'locked-soft';
      this.lastMode = 'soft';
      this.lastSyncedTime = current;
      this.lastSyncReason = seekConfirmed ? 'seek-confirm' : 'deadband';

      if (seekConfirmed) {
        this.target.syncExternalTime(current);
      }

      return this.finishIngest({
        incomingTime: seconds,
        syncedTime: current,
        driftSec: delta,
        mode: 'soft',
        rate: this.rate,
        state: this.state,
        sequence: this.sequence,
        reason: this.lastSyncReason,
      }, receivedAtMs, sourceId, priority, seconds);
    }

    const clampedDelta = Math.max(-(2 / this.detectedFps), Math.min(2 / this.detectedFps, delta));

    const drift = clampedDelta;
    const kp = this.options.smoothingFactor;
    const ki = 0.02;

    this.rateIntegral += drift * ki;
    this.rate = 1 + drift * kp + this.rateIntegral;
    this.rate = Math.max(0.98, Math.min(1.02, this.rate));

    this.lastSyncedTime = current;
    this.lastMode = 'rate';
    this.state = 'locked-soft';
    this.lastSyncReason = 'soft-chase';
    this.pushEvent({ type: 'rate-change', rate: this.rate });
    this.target.setRate?.(this.rate);

    return this.finishIngest({
      incomingTime: seconds,
      syncedTime: current,
      driftSec: delta,
      mode: 'rate',
      rate: this.rate,
      state: this.state,
      sequence: this.sequence,
      reason: this.lastSyncReason,
    }, receivedAtMs, sourceId, priority, seconds);
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
    this.driftAvg = 0;
    this.driftPeak = 0;
    this.pllHistory = new Float32Array(120);
    this.pllIndex = 0;
    this.pllCount = 0;
    this.detectedFps = 30;
    this.activeSource = null;
    this.sources.clear();
    this.historyTime = new Float32Array(120);
    this.events = [];
    this.replayRecord = [];
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
      avgDriftSec: this.driftAvg,
      peakDriftSec: this.driftPeak,
      detectedFps: this.detectedFps,
      activeSource: this.activeSource,
      sourceCount: this.sources.size,
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

  getDriftDiagnostics(): Readonly<LTCDriftDiagnostics> {
    return deepFreeze({
      driftSec: this.lastDriftSec,
      avgDriftSec: this.driftAvg,
      peakDriftSec: this.driftPeak,
      rate: this.rate,
      integral: this.rateIntegral,
      state: this.state,
      fps: this.detectedFps,
    });
  }

  getPLLHistory(): readonly number[] {
    return deepFreeze(Array.from({ length: this.pllCount }, (_, index) => {
      const start = (this.pllIndex - this.pllCount + this.pllHistory.length) % this.pllHistory.length;
      return this.pllHistory[(start + index) % this.pllHistory.length];
    }));
  }

  getDriftSeries(): Readonly<LTCDriftSeries> {
    const start = (this.pllIndex - this.pllCount + this.pllHistory.length) % this.pllHistory.length;
    return deepFreeze({
      drift: Array.from({ length: this.pllCount }, (_, index) => this.pllHistory[(start + index) % this.pllHistory.length]),
      time: Array.from({ length: this.pllCount }, (_, index) => this.historyTime[(start + index) % this.historyTime.length]),
    });
  }

  getEvents(): readonly LTCEvent[] {
    return deepFreeze([...this.events]);
  }

  getPLLDiagnostics(): Readonly<LTCDriftDiagnostics & { source: string | null }> {
    return deepFreeze({
      driftSec: this.lastDriftSec,
      avgDriftSec: this.driftAvg,
      peakDriftSec: this.driftPeak,
      rate: this.rate,
      integral: this.rateIntegral,
      state: this.state,
      fps: this.detectedFps,
      source: this.activeSource,
    });
  }

  getDetectedFps(): number {
    return this.detectedFps;
  }

  getReplayRecord(): readonly LTCReplayFrame[] {
    return deepFreeze([...this.replayRecord]);
  }

  clearReplayRecord(): void {
    this.replayRecord = [];
  }

  replay(record: readonly LTCReplayFrame[]): void {
    this.reset();
    for (const frame of record) {
      this.ingestTime(frame.incoming, frame.time, frame.source, frame.priority);
    }
  }

  private upsertSource(id: string, lastSeen: number, priority: number): LTCSourceState {
    const existing = this.sources.get(id);
    if (existing) {
      existing.lastSeen = lastSeen;
      existing.priority = priority;
      return existing;
    }

    const created: LTCSourceState = { id, lastSeen, drift: 0, priority, lastTime: null };
    this.sources.set(id, created);
    return created;
  }

  private selectBestSource(nowMs: number): LTCSourceState | null {
    const candidates = [...this.sources.values()]
      .filter((source) => nowMs - source.lastSeen < this.options.pauseTimeoutMs)
      .sort((left, right) => left.priority - right.priority || Math.abs(left.drift) - Math.abs(right.drift));

    return candidates[0] ?? null;
  }

  private updateDetectedFps(seconds: number, previousIncomingTime: number | null): void {
    if (previousIncomingTime === null) return;
    const frameDuration = seconds - previousIncomingTime;
    if (!(frameDuration > 0)) return;

    const candidates = [24, 25, 29.97, 30, 60];
    const closest = candidates.reduce((best, candidate) => {
      const bestDistance = Math.abs((1 / best) - frameDuration);
      const candidateDistance = Math.abs((1 / candidate) - frameDuration);
      return candidateDistance < bestDistance ? candidate : best;
    }, this.detectedFps);

    this.detectedFps = this.detectedFps * 0.9 + closest * 0.1;
  }

  private recordDrift(drift: number): void {
    this.driftAvg = this.driftAvg * (1 - this.driftAlpha) + drift * this.driftAlpha;
    this.driftPeak = Math.max(this.driftPeak * 0.98, Math.abs(drift));
    this.pllHistory[this.pllIndex] = drift;
    this.historyTime[this.pllIndex] = this.lastIncomingTime ?? 0;
    this.pllIndex = (this.pllIndex + 1) % this.pllHistory.length;
    this.pllCount = Math.min(this.pllCount + 1, this.pllHistory.length);
  }

  private pushEvent(event: LTCEvent): void {
    this.events.push(event);
    if (this.events.length > 256) {
      this.events = this.events.slice(-256);
    }
  }

  private finishIngest(
    sample: LTCSyncSample | null,
    receivedAtMs: number,
    sourceId: string,
    priority: number,
    incoming: number,
  ): LTCSyncSample | null {
    this.replayRecord.push({
      time: receivedAtMs,
      source: sourceId,
      priority,
      incoming,
      diagnostics: this.getPLLDiagnostics(),
      sample,
    });

    if (this.replayRecord.length > 1024) {
      this.replayRecord = this.replayRecord.slice(-1024);
    }

    return sample;
  }
}

export const createTimelineClockLTCTarget = (target: LTCSyncTarget): LTCSyncTarget => target;