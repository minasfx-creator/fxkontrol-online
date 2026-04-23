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
  jitterClampSec: number;
  dropFrameThresholdFrames: number;
}

export type LTCSyncMode = 'soft' | 'hard' | 'rate';
export type LTCState = 'unlocked' | 'locking' | 'locked' | 'freewheel' | 'resync';
export type LTCChaseMode = 'tight' | 'smooth' | 'freewheel' | 'external-master';

export interface LTCSyncSample {
  incomingTime: number;
  syncedTime: number;
  driftSec: number;
  mode: LTCSyncMode;
  rate?: number;
  state: LTCState;
  sequence: number;
  reason:
    | 'soft-chase'
    | 'deadband'
    | 'hard-resync'
    | 'rewind-detect'
    | 'seek-confirm'
    | 'drop-detect'
    | 'freewheel-hold'
    | 'external-master';
}

export interface LTCTransportDiagnostics {
  signalPresent: boolean;
  lastIncomingTime: number | null;
  lastRawIncomingTime: number | null;
  lastSyncedTime: number | null;
  lastSignalAt: number | null;
  lastDriftSec: number;
  lastJitterSec: number;
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
  jitterClampSec: number;
  dropFrameThresholdFrames: number;
  freewheelFrames: number;
  chaseMode: LTCChaseMode;
}

export interface LTCDriftDiagnostics {
  driftSec: number;
  avgDriftSec: number;
  peakDriftSec: number;
  rate: number;
  integral: number;
  jitterSec: number;
  state: LTCState;
  fps?: number;
}

export type LTCEvent =
  | { type: 'source-switch'; from: string | null; to: string; time: number; sequence: number }
  | { type: 'hard-sync'; reason: LTCSyncSample['reason']; time: number; sequence: number }
  | { type: 'rate-change'; rate: number; time: number; sequence: number }
  | { type: 'drop'; frames: number; time: number; sequence: number }
  | { type: 'freewheel'; time: number; sequence: number };

export interface LTCDriftSeries {
  drift: readonly number[];
  time: readonly number[];
}

export interface LTCTelemetrySeries {
  time: readonly number[];
  drift: readonly number[];
  raw: readonly number[];
  filtered: readonly number[];
  clock: readonly number[];
}

export interface LTCReplayFrame {
  time: number;
  source: string;
  priority: number;
  incoming: number;
  filteredIncoming: number;
  clockOutput: number;
  diagnostics: LTCDriftDiagnostics & { source: string | null };
  sample: LTCSyncSample | null;
  kalmanGain: number;
  chaseMode: LTCChaseMode;
  state: LTCState;
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

interface ChaseProfile {
  kp: number;
  ki: number;
  rateClamp: number;
  deadbandFrames: number;
  snapFrames: number;
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
  jitterClampSec: 0.02,
  dropFrameThresholdFrames: 2,
};

const CHASE_PROFILES: Record<LTCChaseMode, ChaseProfile> = {
  tight: {
    kp: 0.6,
    ki: 0.03,
    rateClamp: 0.02,
    deadbandFrames: 1,
    snapFrames: 1,
  },
  smooth: {
    kp: 0.15,
    ki: 0.02,
    rateClamp: 0.02,
    deadbandFrames: 1,
    snapFrames: 8,
  },
  freewheel: {
    kp: 0.05,
    ki: 0.01,
    rateClamp: 0.01,
    deadbandFrames: 2,
    snapFrames: Number.POSITIVE_INFINITY,
  },
  'external-master': {
    kp: 1,
    ki: 0,
    rateClamp: 0,
    deadbandFrames: 0,
    snapFrames: 0,
  },
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cloneReplayFrame(frame: LTCReplayFrame): LTCReplayFrame {
  return {
    ...frame,
    diagnostics: { ...frame.diagnostics },
    sample: frame.sample ? { ...frame.sample } : null,
  };
}

export class LTCTransport {
  private readonly options: Required<LTCTransportOptions>;
  private lastIncomingTime: number | null = null;
  private lastRawIncomingTime: number | null = null;
  private lastSyncedTime: number | null = null;
  private lastSignalAt: number | null = null;
  private lastDriftSec = 0;
  private lastJitterSec = 0;
  private lastMode: LTCSyncMode | 'idle' = 'idle';
  private state: LTCState = 'unlocked';
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
  private rawHistory = new Float32Array(120);
  private filteredHistory = new Float32Array(120);
  private clockHistory = new Float32Array(120);
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
  private kalmanGain = 0;
  private eventSubscribers = new Set<(event: LTCEvent) => void>();
  private chaseMode: LTCChaseMode = 'smooth';
  private freewheelFrames = 0;

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
      jitterClampSec: options.jitterClampSec ?? DEFAULT_OPTIONS.jitterClampSec,
      dropFrameThresholdFrames: options.dropFrameThresholdFrames ?? DEFAULT_OPTIONS.dropFrameThresholdFrames,
    };
  }

  ingestTime(rawSeconds: number, receivedAtMs = Date.now(), sourceId = 'default', priority = 0): LTCSyncSample | null {
    if (!Number.isFinite(rawSeconds) || !Number.isFinite(receivedAtMs)) {
      return null;
    }

    const kalmanSeconds = this.filterIncoming(rawSeconds);
    const filteredSeconds = this.clampIncomingJitter(rawSeconds, kalmanSeconds);
    const source = this.upsertSource(sourceId, receivedAtMs, priority);
    const previousIncomingTime = source.lastTime;
    source.lastTime = filteredSeconds;

    const bestSource = this.selectBestSource(receivedAtMs);
    const sourceSwitch = bestSource !== null && bestSource.id !== this.activeSource;

    if (sourceSwitch) {
      const previousSource = this.activeSource;
      this.activeSource = bestSource?.id ?? null;
      if (this.activeSource) {
        this.pushEvent({ type: 'source-switch', from: previousSource, to: this.activeSource, time: receivedAtMs, sequence: this.sequence + 1 });
      }
    } else if (this.activeSource === null) {
      this.activeSource = source.id;
    }

    if (this.activeSource !== source.id) {
      return this.finishIngest(null, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, this.target.getTime());
    }

    this.lastRawIncomingTime = rawSeconds;
    this.lastIncomingTime = filteredSeconds;
    this.lastSignalAt = receivedAtMs;
    this.sequence += 1;
    this.freewheelFrames = 0;

    this.updateDetectedFps(filteredSeconds, previousIncomingTime);
    const frameDurationSec = 1 / Math.max(this.detectedFps, 1);
    const deltaFrames = previousIncomingTime === null
      ? 0
      : Math.max(0, Math.round((filteredSeconds - previousIncomingTime) / frameDurationSec) - 1);
    if (deltaFrames > this.options.dropFrameThresholdFrames) {
      this.pushEvent({ type: 'drop', frames: deltaFrames, time: receivedAtMs, sequence: this.sequence });
    }

    if (!this.locked) {
      this.unlockCounter = 0;
      this.lockCounter += 1;
      this.state = 'locking';

      if (this.lockCounter >= this.options.lockFrames) {
        this.locked = true;
        this.state = 'locked';
      }

      return this.finishIngest(null, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, this.target.getTime());
    }

    this.lockCounter = 0;
    this.unlockCounter = 0;

    const current = this.target.getTime();
    const delta = filteredSeconds - current;
    this.lastDriftSec = delta;
    source.drift = delta;

    const hardReason = this.resolveHardReason(delta, deltaFrames, sourceSwitch);
    if (hardReason) {
      const sample = this.applyHardSync(filteredSeconds, delta, receivedAtMs, hardReason);
      return this.finishIngest(sample, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, filteredSeconds);
    }

    if (this.chaseMode === 'external-master') {
      this.state = 'locked';
      this.lastMode = 'hard';
      this.lastSyncedTime = filteredSeconds;
      this.lastSyncReason = 'external-master';
      this.lastJitterSec = filteredSeconds - rawSeconds;
      this.recordDrift(delta, rawSeconds, filteredSeconds, filteredSeconds);
      this.target.setRate?.(1);
      this.target.syncExternalTime(filteredSeconds);

      const sample: LTCSyncSample = {
        incomingTime: filteredSeconds,
        syncedTime: filteredSeconds,
        driftSec: delta,
        mode: 'hard',
        rate: 1,
        state: this.state,
        sequence: this.sequence,
        reason: 'external-master',
      };

      return this.finishIngest(sample, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, filteredSeconds);
    }

    const profile = CHASE_PROFILES[this.chaseMode];
    const deadbandSec = Math.max(this.options.deadbandSec, profile.deadbandFrames / Math.max(this.detectedFps, 1));
    this.lastJitterSec = filteredSeconds - rawSeconds;

    if (Math.abs(delta) <= deadbandSec) {
      const seekConfirmed = previousIncomingTime !== null && Math.abs(current - previousIncomingTime) > deadbandSec;
      this.state = 'locked';
      this.lastMode = 'soft';
      this.lastSyncedTime = current;
      this.lastSyncReason = seekConfirmed ? 'seek-confirm' : 'deadband';
      this.recordDrift(delta, rawSeconds, filteredSeconds, current);

      if (seekConfirmed) {
        this.target.syncExternalTime(current);
      }

      const sample: LTCSyncSample = {
        incomingTime: filteredSeconds,
        syncedTime: current,
        driftSec: delta,
        mode: 'soft',
        rate: this.rate,
        state: this.state,
        sequence: this.sequence,
        reason: this.lastSyncReason,
      };

      return this.finishIngest(sample, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, current);
    }

    const snapThresholdSec = Number.isFinite(profile.snapFrames)
      ? profile.snapFrames / Math.max(this.detectedFps, 1)
      : Number.POSITIVE_INFINITY;
    if (Math.abs(delta) >= snapThresholdSec) {
      const sample = this.applyHardSync(filteredSeconds, delta, receivedAtMs, 'hard-resync');
      return this.finishIngest(sample, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, filteredSeconds);
    }

    const clampedDelta = clamp(delta, -this.options.maxCorrectionPerFrame, this.options.maxCorrectionPerFrame);
    this.rateIntegral = clamp(this.rateIntegral + clampedDelta * profile.ki, -profile.rateClamp, profile.rateClamp);
    this.rate = clamp(1 + clampedDelta * profile.kp + this.rateIntegral, 1 - profile.rateClamp, 1 + profile.rateClamp);

    this.lastSyncedTime = current;
    this.lastMode = 'rate';
    this.state = 'locked';
    this.lastSyncReason = 'soft-chase';
    this.recordDrift(delta, rawSeconds, filteredSeconds, current);
    this.pushEvent({ type: 'rate-change', rate: this.rate, time: receivedAtMs, sequence: this.sequence });
    this.target.setRate?.(this.rate);

    const sample: LTCSyncSample = {
      incomingTime: filteredSeconds,
      syncedTime: current,
      driftSec: delta,
      mode: 'rate',
      rate: this.rate,
      state: this.state,
      sequence: this.sequence,
      reason: this.lastSyncReason,
    };

    return this.finishIngest(sample, receivedAtMs, sourceId, priority, rawSeconds, filteredSeconds, current);
  }

  isSignalPresent(nowMs = Date.now()): boolean {
    const present = this.lastSignalAt !== null && Number.isFinite(nowMs)
      ? nowMs - this.lastSignalAt <= this.options.pauseTimeoutMs
      : false;

    if (!present && this.locked) {
      this.unlockCounter += 1;
      if (this.unlockCounter >= this.options.unlockFrames) {
        this.state = 'freewheel';
        this.lastMode = 'soft';
        this.lastSyncReason = 'freewheel-hold';
        this.rate = 1;
        this.target.setRate?.(1);
        const nextTime = (this.lastSyncedTime ?? this.target.getTime()) + 1 / Math.max(this.detectedFps, 1);
        this.lastSyncedTime = nextTime;
        this.freewheelFrames += 1;
        if (!this.events.length || this.events[this.events.length - 1]?.type !== 'freewheel') {
          this.pushEvent({ type: 'freewheel', time: nowMs, sequence: this.sequence });
        }
      }
    } else if (present) {
      this.unlockCounter = 0;
      if (this.state === 'freewheel') {
        this.state = 'locked';
      }
    }

    return present;
  }

  reset(): void {
    this.stopReplay();
    this.lastIncomingTime = null;
    this.lastRawIncomingTime = null;
    this.lastSyncedTime = null;
    this.lastSignalAt = null;
    this.lastDriftSec = 0;
    this.lastJitterSec = 0;
    this.lastMode = 'idle';
    this.sequence = 0;
    this.lastSyncReason = 'idle';
    this.rate = 1;
    this.rateIntegral = 0;
    this.driftAvg = 0;
    this.driftPeak = 0;
    this.pllHistory = new Float32Array(120);
    this.rawHistory = new Float32Array(120);
    this.filteredHistory = new Float32Array(120);
    this.clockHistory = new Float32Array(120);
    this.pllIndex = 0;
    this.pllCount = 0;
    this.detectedFps = 30;
    this.activeSource = null;
    this.sources.clear();
    this.historyTime = new Float32Array(120);
    this.events = [];
    this.replayRecord = [];
    this.state = 'unlocked';
    this.lockCounter = 0;
    this.unlockCounter = 0;
    this.locked = false;
    this.freewheelFrames = 0;
    this.resetKalman();
  }

  getDiagnostics(nowMs = Date.now()): Readonly<LTCTransportDiagnostics> {
    return deepFreeze({
      signalPresent: this.isSignalPresent(nowMs),
      lastIncomingTime: this.lastIncomingTime,
      lastRawIncomingTime: this.lastRawIncomingTime,
      lastSyncedTime: this.lastSyncedTime,
      lastSignalAt: this.lastSignalAt,
      lastDriftSec: this.lastDriftSec,
      lastJitterSec: this.lastJitterSec,
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
      jitterClampSec: this.options.jitterClampSec,
      dropFrameThresholdFrames: this.options.dropFrameThresholdFrames,
      freewheelFrames: this.freewheelFrames,
      chaseMode: this.chaseMode,
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
      jitterSec: this.lastJitterSec,
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
    const telemetry = this.getTelemetrySeries();
    return deepFreeze({ drift: [...telemetry.drift], time: [...telemetry.time] });
  }

  getTelemetrySeries(): Readonly<LTCTelemetrySeries> {
    const start = (this.pllIndex - this.pllCount + this.pllHistory.length) % this.pllHistory.length;
    return deepFreeze({
      drift: Array.from({ length: this.pllCount }, (_, index) => this.pllHistory[(start + index) % this.pllHistory.length]),
      time: Array.from({ length: this.pllCount }, (_, index) => this.historyTime[(start + index) % this.historyTime.length]),
      raw: Array.from({ length: this.pllCount }, (_, index) => this.rawHistory[(start + index) % this.rawHistory.length]),
      filtered: Array.from({ length: this.pllCount }, (_, index) => this.filteredHistory[(start + index) % this.filteredHistory.length]),
      clock: Array.from({ length: this.pllCount }, (_, index) => this.clockHistory[(start + index) % this.clockHistory.length]),
    });
  }

  getEvents(): readonly LTCEvent[] {
    return deepFreeze([...this.events]);
  }

  getPLLDiagnostics(): Readonly<LTCDriftDiagnostics & { source: string | null; chaseMode: LTCChaseMode }> {
    return deepFreeze({
      driftSec: this.lastDriftSec,
      avgDriftSec: this.driftAvg,
      peakDriftSec: this.driftPeak,
      rate: this.rate,
      integral: this.rateIntegral,
      jitterSec: this.lastJitterSec,
      state: this.state,
      fps: this.detectedFps,
      source: this.activeSource,
      chaseMode: this.chaseMode,
    });
  }

  getDetectedFps(): number {
    return this.detectedFps;
  }

  getReplayRecord(): readonly LTCReplayFrame[] {
    return deepFreeze(this.replayRecord.map(cloneReplayFrame));
  }

  clearReplayRecord(): void {
    this.replayRecord = [];
  }

  replay(record: readonly LTCReplayFrame[]): void {
    this.stopReplay();
    this.resetForReplay(record);
    for (const frame of record) {
      this.applyReplayFrame(frame);
    }
  }

  replayAsync(record: readonly LTCReplayFrame[], options: LTCReplayOptions = {}): void {
    this.stopReplay();
    this.resetForReplay(record);
    const speed = Math.max(0.1, options.speed ?? 1);
    const step = options.step ?? false;
    this.replayCursor = 0;

    const advance = () => {
      if (this.replayCursor >= record.length) {
        this.stopReplay();
        return;
      }

      const frame = record[this.replayCursor];
      this.applyReplayFrame(frame);
      options.onFrame?.(frame, this.replayCursor, record.length);
      this.replayCursor += 1;

      if (step || this.replayCursor >= record.length) {
        return;
      }

      const nextFrame = record[this.replayCursor];
      const deltaMs = Math.max(0, (nextFrame.time - frame.time) / speed);
      this.replayTimer = setTimeout(advance, deltaMs);
    };

    advance();
  }

  stopReplay(): void {
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
  }

  stepReplay(record: readonly LTCReplayFrame[], options: Omit<LTCReplayOptions, 'step'> = {}): void {
    this.replayAsync(record, { ...options, step: true });
  }

  setKalmanEnabled(enabled: boolean): void {
    this.kalmanEnabled = enabled;
    if (!enabled) {
      this.resetKalman();
    }
  }

  isKalmanEnabled(): boolean {
    return this.kalmanEnabled;
  }

  setChaseMode(mode: LTCChaseMode): void {
    this.chaseMode = mode;
  }

  getChaseMode(): LTCChaseMode {
    return this.chaseMode;
  }

  exportEvents(): string {
    return JSON.stringify(this.events);
  }

  subscribeEvents(callback: (event: LTCEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    return () => this.eventSubscribers.delete(callback);
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

  private recordDrift(drift: number, raw: number, filtered: number, clock: number): void {
    this.driftAvg = this.driftAvg * (1 - this.driftAlpha) + drift * this.driftAlpha;
    this.driftPeak = Math.max(this.driftPeak * 0.98, Math.abs(drift));
    this.pllHistory[this.pllIndex] = drift;
    this.rawHistory[this.pllIndex] = raw;
    this.filteredHistory[this.pllIndex] = filtered;
    this.clockHistory[this.pllIndex] = clock;
    this.historyTime[this.pllIndex] = filtered;
    this.pllIndex = (this.pllIndex + 1) % this.pllHistory.length;
    this.pllCount = Math.min(this.pllCount + 1, this.pllHistory.length);
  }

  private pushEvent(event: LTCEvent): void {
    this.events.push(event);
    if (this.events.length > 256) {
      this.events = this.events.slice(-256);
    }
    for (const subscriber of this.eventSubscribers) {
      subscriber(event);
    }
  }

  private filterIncoming(time: number): number {
    if (!this.kalmanEnabled) {
      this.kalmanGain = 0;
      return time;
    }

    if (this.kalmanEstimate === 0) {
      this.kalmanEstimate = time;
      this.kalmanGain = 1;
      return time;
    }

    const jitter = Math.abs(time - this.kalmanEstimate);
    const q = 0.00001;
    const r = jitter > this.options.jitterClampSec ? 0.005 : 0.001;

    this.kalmanError += q;
    const k = this.kalmanError / (this.kalmanError + r);
    const nextEstimate = this.kalmanEstimate + k * (time - this.kalmanEstimate);
    const maxVelocity = (1 / Math.max(this.detectedFps, 1)) * 2;
    const velocity = clamp(nextEstimate - this.kalmanEstimate, -maxVelocity, maxVelocity);

    this.kalmanEstimate += velocity;
    this.kalmanError *= 1 - k;
    this.kalmanGain = k;

    return this.kalmanEstimate;
  }

  private clampIncomingJitter(rawTime: number, filteredTime: number): number {
    if (this.lastIncomingTime === null) {
      return filteredTime;
    }

    if (Math.abs(rawTime - this.lastIncomingTime) > this.options.hardResyncThreshold) {
      return rawTime;
    }

    const frameDuration = 1 / Math.max(this.detectedFps, 1);
    if (Math.abs(rawTime - this.lastIncomingTime) > frameDuration * (this.options.dropFrameThresholdFrames + 1)) {
      return rawTime;
    }

    return clamp(
      filteredTime,
      this.lastIncomingTime - this.options.jitterClampSec,
      this.lastIncomingTime + this.options.jitterClampSec,
    );
  }

  private resolveHardReason(delta: number, deltaFrames: number, sourceSwitch: boolean): LTCSyncSample['reason'] | null {
    if (sourceSwitch) {
      return 'hard-resync';
    }
    if (delta < -this.options.rewindThreshold) {
      return 'rewind-detect';
    }
    if (deltaFrames > this.options.dropFrameThresholdFrames) {
      return 'drop-detect';
    }
    if (Math.abs(delta) > this.options.hardResyncThreshold) {
      return 'hard-resync';
    }
    return null;
  }

  private applyHardSync(seconds: number, delta: number, receivedAtMs: number, reason: LTCSyncSample['reason']): LTCSyncSample {
    this.state = 'resync';
    this.lastMode = 'hard';
    this.lastSyncedTime = seconds;
    this.lastSyncReason = reason;
    this.rate = 1;
    this.rateIntegral = 0;
    this.lastJitterSec = seconds - (this.lastRawIncomingTime ?? seconds);
    this.recordDrift(delta, this.lastRawIncomingTime ?? seconds, seconds, seconds);
    this.resetKalman(seconds);
    this.pushEvent({ type: 'hard-sync', reason, time: receivedAtMs, sequence: this.sequence });
    this.target.setRate?.(1);
    this.target.syncExternalTime(seconds);
    this.state = 'locked';

    return {
      incomingTime: seconds,
      syncedTime: seconds,
      driftSec: delta,
      mode: 'hard',
      rate: 1,
      state: this.state,
      sequence: this.sequence,
      reason,
    };
  }

  private resetKalman(seed?: number): void {
    this.kalmanEstimate = seed ?? 0;
    this.kalmanError = 1;
    this.kalmanGain = 0;
  }

  private resetForReplay(record: readonly LTCReplayFrame[]): void {
    this.stopReplay();
    const chaseMode = this.chaseMode;
    const kalmanEnabled = this.kalmanEnabled;
    this.reset();
    this.chaseMode = chaseMode;
    this.kalmanEnabled = kalmanEnabled;
    this.replayRecord = record.map(cloneReplayFrame);
  }

  private applyReplayFrame(frame: LTCReplayFrame): void {
    this.lastRawIncomingTime = frame.incoming;
    this.lastIncomingTime = frame.filteredIncoming;
    this.lastSyncedTime = frame.clockOutput;
    this.lastSignalAt = frame.time;
    this.lastDriftSec = frame.diagnostics.driftSec;
    this.lastJitterSec = frame.diagnostics.jitterSec;
    this.rate = frame.diagnostics.rate;
    this.rateIntegral = frame.diagnostics.integral;
    this.driftAvg = frame.diagnostics.avgDriftSec;
    this.driftPeak = frame.diagnostics.peakDriftSec;
    this.detectedFps = frame.diagnostics.fps ?? this.detectedFps;
    this.activeSource = frame.diagnostics.source;
    this.chaseMode = frame.chaseMode;
    this.state = frame.state;
    this.locked = frame.state !== 'unlocked' && frame.state !== 'locking';
    this.lastMode = frame.sample?.mode ?? 'idle';
    this.lastSyncReason = frame.sample?.reason ?? 'idle';
    this.sequence = frame.sample?.sequence ?? this.sequence + 1;
    this.kalmanGain = frame.kalmanGain;
    this.recordDrift(frame.diagnostics.driftSec, frame.incoming, frame.filteredIncoming, frame.clockOutput);

    if (frame.sample?.mode === 'hard' || frame.chaseMode === 'external-master' || frame.sample?.reason === 'seek-confirm') {
      this.target.syncExternalTime(frame.clockOutput);
    }
    if (frame.sample?.rate !== undefined) {
      this.target.setRate?.(frame.sample.rate);
    }
  }

  private finishIngest(
    sample: LTCSyncSample | null,
    receivedAtMs: number,
    sourceId: string,
    priority: number,
    incoming: number,
    filteredIncoming: number,
    clockOutput: number,
  ): LTCSyncSample | null {
    this.replayRecord.push({
      time: receivedAtMs,
      source: sourceId,
      priority,
      incoming,
      filteredIncoming,
      clockOutput,
      diagnostics: this.getPLLDiagnostics(),
      sample,
      kalmanGain: this.kalmanGain,
      chaseMode: this.chaseMode,
      state: this.state,
    });

    if (this.replayRecord.length > 1024) {
      this.replayRecord = this.replayRecord.slice(-1024);
    }

    return sample;
  }
}

export const createTimelineClockLTCTarget = (target: LTCSyncTarget): LTCSyncTarget => target;
