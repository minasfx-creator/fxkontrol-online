const HEARTBEAT_INTERVAL_MS = 100;
const HEARTBEAT_FREEZE_MS = 300;
const HEARTBEAT_AUTODISARM_MS = 1000;

export type PhysicalState =
  | 'intent'
  | 'queued'
  | 'sent'
  | 'acked'
  | 'armed'
  | 'fired'
  | 'confirmed'
  | 'done'
  | 'failed';

export type WatchdogState = 'idle' | 'stable' | 'degraded' | 'freeze' | 'disarmed';

export interface PhysicalCommandRecord {
  id: string;
  target: string;
  channelId?: string;
  state: PhysicalState;
  createdAt: number;
  updatedAt: number;
  history: Array<{ state: PhysicalState; at: number; reason?: string }>;
  failureReason?: string;
}

export interface HeartbeatFrame {
  seq: number;
  tick: number;
  monotonicTime: number;
}

export interface ClockSyncSample {
  t0: number;
  t1: number;
  t2: number;
  t3: number;
}

export interface PhysicalRuntimeSnapshot {
  watchdogState: WatchdogState;
  systemArmed: boolean;
  freezeTriggered: boolean;
  autoDisarmed: boolean;
  hilModeEnabled: boolean;
  hilProfile: HilFaultProfile;
  heartbeatIntervalMs: number;
  heartbeatAgeMs: number | null;
  lastHeartbeatSeq: number | null;
  clockOffsetMs: number;
  estimatedHardwareTime: number;
  totalCommands: number;
  commandCounts: Record<PhysicalState, number>;
  activeCommands: PhysicalCommandRecord[];
}

export interface HilLogEntry {
  time: number;
  channel: string;
  event: 'scheduled' | 'sent' | 'ack' | 'loss' | 'reorder' | 'cancel';
  delayMs?: number;
}

export interface CommandTimeline {
  commandId: string;
  channel: string;
  scheduledAt: number;
  sentAt?: number;
  ackAt?: number;
  doneAt?: number;
  failedAt?: number;
}

export interface HilRunReport {
  runStart: number;
  profile: HilFaultProfile;
  logs: readonly HilLogEntry[];
  timeline: readonly CommandTimeline[];
  stats: {
    total: number;
    acked: number;
    failed: number;
  };
}

export interface HilDriftHistogram {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  buckets: Array<{ rangeMs: [number, number]; count: number }>;
}

export interface HilCompareResult {
  lossDelta: number;
  ackDelta: number;
  jitterP95Delta: number;
  meanDelta: number;
  totalDelta: number;
}

export interface HilRegressionRule {
  maxFailed?: number;
  maxP95Ms?: number;
  maxAbsoluteMs?: number;
  minAckRate?: number;
}

export interface HilRegressionResult {
  passed: boolean;
  failures: string[];
  metrics: {
    failed: number;
    p95: number;
    max: number;
    ackRate: number;
  };
}

export interface FireLockoutInput {
  systemArmed: boolean;
  deadmanHeld: boolean;
  dualConfirmRequired: boolean;
  dualConfirmed: boolean;
  alreadyFired: boolean;
  requiresWatchdog: boolean;
  watchdogState: WatchdogState;
}

export interface FireLockoutResult {
  allowed: boolean;
  reason?: string;
}

type RuntimeListener = () => void;

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === 'object') deepFreeze(nested);
  }
  return value as Readonly<T>;
}

const VALID_TRANSITIONS: Record<PhysicalState, PhysicalState[]> = {
  intent: ['queued', 'failed'],
  queued: ['sent', 'failed'],
  sent: ['acked', 'failed'],
  acked: ['armed', 'failed'],
  armed: ['fired', 'failed'],
  fired: ['confirmed', 'failed'],
  confirmed: ['done', 'failed'],
  done: [],
  failed: [],
};

export function assertPhysicalTransition(prev: PhysicalState, next: PhysicalState): void {
  if (!VALID_TRANSITIONS[prev]?.includes(next)) {
    throw new Error(`Invalid physical transition: ${prev} -> ${next}`);
  }
}

export function calculateClockOffset(sample: ClockSyncSample): number {
  return ((sample.t1 - sample.t0) + (sample.t2 - sample.t3)) / 2;
}

export function evaluateFireLockout(input: FireLockoutInput): FireLockoutResult {
  if (!input.systemArmed) return { allowed: false, reason: 'Sistema não armado fisicamente.' };
  if (!input.deadmanHeld) return { allowed: false, reason: 'Deadman não está mantido.' };
  if (input.dualConfirmRequired && !input.dualConfirmed) {
    return { allowed: false, reason: 'Confirmação dupla obrigatória ainda não validada.' };
  }
  if (input.alreadyFired) return { allowed: false, reason: 'Canal já disparado nesta janela.' };
  if (input.requiresWatchdog && (input.watchdogState === 'freeze' || input.watchdogState === 'disarmed')) {
    return { allowed: false, reason: 'Watchdog físico bloqueou o FIRE por perda de heartbeat.' };
  }
  return { allowed: true };
}

class BridgePhysicalController {
  private commands = new Map<string, PhysicalCommandRecord>();
  private listeners = new Set<RuntimeListener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatMonitorTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatSend?: (frame: HeartbeatFrame) => void;
  private lastPongAt: number | null = null;
  private lastHeartbeatSeq: number | null = null;
  private heartbeatSeq = 0;
  private clockOffsetMs = 0;
  private tick = 0;
  private watchdogState: WatchdogState = 'idle';
  private systemArmed = false;
  private freezeTriggered = false;
  private autoDisarmed = false;
  private hilModeEnabled = false;
  private hilProfile: HilFaultProfile = { jitterMs: 15, baseDelayMs: 40, packetLossRate: 0, reorderRate: 0 };
  private hilHarness = new HilBridgeHarness(this.hilProfile);
  private hilRunStart = performance.now();
  private hilLogs: HilLogEntry[] = [];
  private commandTimeline = new Map<string, CommandTimeline>();
  private hilTimers = new Map<string, ReturnType<typeof setTimeout>>();

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      try { listener(); } catch {}
    });
  }

  setSystemArmed(armed: boolean): void {
    this.systemArmed = armed;
    if (!armed) {
      this.autoDisarmed = false;
    }
    this.emit();
  }

  configureHil(enabled: boolean, profile?: Partial<HilFaultProfile>): void {
    this.hilModeEnabled = enabled;
    this.hilProfile = {
      ...this.hilProfile,
      ...(profile ?? {}),
    };
    this.hilHarness = new HilBridgeHarness(this.hilProfile);
    this.hilRunStart = performance.now();
    this.emit();
  }

  async simulateHilFire(channelId: string, onAcknowledge: (channel: string, meta: { delayMs: number; reordered: boolean }) => void): Promise<boolean> {
    return this.hilHarness.fire(channelId, (channel, meta) => {
      if (meta.reordered) {
        this.pushHilLog({
          time: performance.now(),
          channel,
          event: 'reorder',
          delayMs: meta.delayMs,
        });
      }
      onAcknowledge(channel, meta);
    });
  }

  private pushHilLog(entry: HilLogEntry): void {
    this.hilLogs.push(entry);
    if (this.hilLogs.length > 512) {
      this.hilLogs = this.hilLogs.slice(-512);
    }
  }

  getHilLogs(): readonly HilLogEntry[] {
    return deepFreeze([...this.hilLogs]);
  }

  getCommandTimeline(): readonly CommandTimeline[] {
    return deepFreeze([...this.commandTimeline.values()].map((entry) => ({ ...entry })));
  }

  validateHilBeforeFire(): { ok: boolean; reason?: string } {
    if (!this.hilModeEnabled) return { ok: true };
    if (this.hilProfile.packetLossRate > 0.5) return { ok: false, reason: 'loss-rate-too-high' };
    if (this.hilProfile.baseDelayMs > 500) return { ok: false, reason: 'delay-too-high' };
    return { ok: true };
  }

  exportHilReport(): Readonly<HilRunReport> {
    const timeline = [...this.commandTimeline.values()].map((entry) => ({ ...entry }));
    const acked = timeline.filter((entry) => entry.ackAt).length;
    const failed = timeline.filter((entry) => entry.failedAt).length;
    return deepFreeze({
      runStart: this.hilRunStart,
      profile: { ...this.hilProfile },
      logs: [...this.hilLogs],
      timeline,
      stats: {
        total: this.commandTimeline.size,
        acked,
        failed,
      },
    });
  }

  exportHilReportJSON(): string {
    return JSON.stringify(this.exportHilReport(), null, 2);
  }

  resetHilRun(): void {
    for (const t of this.hilTimers.values()) clearTimeout(t);
    this.hilTimers.clear();
    this.hilRunStart = performance.now();
    this.hilLogs = [];
    this.commandTimeline.clear();
    this.emit();
  }

  registerHilTimer(commandId: string, timer: ReturnType<typeof setTimeout>): void {
    this.hilTimers.set(commandId, timer);
  }

  clearHilTimer(commandId: string): void {
    this.hilTimers.delete(commandId);
  }

  cancelHilCommand(commandId: string): void {
    const timeline = this.commandTimeline.get(commandId);
    if (!timeline || timeline.doneAt || timeline.ackAt) return;
    const timer = this.hilTimers.get(commandId);
    const command = this.commands.get(commandId);
    if (timer) {
      clearTimeout(timer);
      this.hilTimers.delete(commandId);
    }
    if (command?.channelId) {
      this.pushHilLog({
        time: performance.now(),
        event: 'cancel',
        channel: command.channelId,
      });
    }
    this.failCommand(commandId, 'cancelled');
  }

  beginCommand(id: string, target: string, channelId?: string): PhysicalCommandRecord {
    const now = performance.now();
    const record: PhysicalCommandRecord = {
      id,
      target,
      channelId,
      state: 'intent',
      createdAt: now,
      updatedAt: now,
      history: [{ state: 'intent', at: now }],
    };
    this.commands.set(id, record);
    if (channelId) {
      this.commandTimeline.set(id, {
        commandId: id,
        channel: channelId,
        scheduledAt: now,
      });
      this.pushHilLog({ time: now, channel: channelId, event: 'scheduled' });
    }
    this.emit();
    return record;
  }

  transitionCommand(id: string, next: PhysicalState, reason?: string): PhysicalCommandRecord | null {
    const record = this.commands.get(id);
    if (!record) return null;
    assertPhysicalTransition(record.state, next);
    const now = performance.now();
    record.state = next;
    record.updatedAt = now;
    if (next === 'failed') record.failureReason = reason;
    record.history.push({ state: next, at: now, reason });
    const timeline = this.commandTimeline.get(id);
    if (timeline) {
      if (next === 'sent') timeline.sentAt = Math.max(timeline.sentAt ?? 0, now);
      if (next === 'confirmed') timeline.ackAt = Math.max(timeline.ackAt ?? 0, now);
      if (next === 'done') timeline.doneAt = Math.max(timeline.doneAt ?? 0, now);
      if (next === 'failed') timeline.failedAt = Math.max(timeline.failedAt ?? 0, now);
    }
    if (record.channelId) {
      if (next === 'sent') this.pushHilLog({ time: now, channel: record.channelId, event: 'sent' });
      if (next === 'confirmed') this.pushHilLog({ time: now, channel: record.channelId, event: 'ack' });
    }
    this.emit();
    return record;
  }

  failCommand(id: string, reason: string): void {
    const record = this.commands.get(id);
    if (!record || record.state === 'failed' || record.state === 'done') return;
    const now = performance.now();
    record.state = 'failed';
    record.updatedAt = now;
    record.failureReason = reason;
    record.history.push({ state: 'failed', at: now, reason });
    const timeline = this.commandTimeline.get(id);
    if (timeline) timeline.failedAt = now;
    if (record.channelId) this.pushHilLog({ time: now, channel: record.channelId, event: 'loss' });
    this.emit();
  }

  wasChannelFired(channelId: string): boolean {
    for (const record of this.commands.values()) {
      if (record.channelId === channelId && (record.state === 'fired' || record.state === 'confirmed' || record.state === 'done')) {
        return true;
      }
    }
    return false;
  }

  startWatchdog(sendHeartbeat: (frame: HeartbeatFrame) => void): void {
    this.stopWatchdog();
    this.heartbeatSend = sendHeartbeat;
    this.freezeTriggered = false;
    this.autoDisarmed = false;
    this.watchdogState = 'stable';
    this.lastPongAt = performance.now();

    this.heartbeatTimer = setInterval(() => {
      this.tick += 1;
      const frame: HeartbeatFrame = {
        seq: ++this.heartbeatSeq,
        tick: this.tick,
        monotonicTime: performance.now(),
      };
      this.heartbeatSend?.(frame);
      this.emit();
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatMonitorTimer = setInterval(() => {
      const now = performance.now();
      const age = this.lastPongAt === null ? Infinity : now - this.lastPongAt;
      if (age > HEARTBEAT_AUTODISARM_MS) {
        this.watchdogState = 'disarmed';
        this.systemArmed = false;
        this.autoDisarmed = true;
        this.freezeTriggered = true;
      } else if (age > HEARTBEAT_FREEZE_MS) {
        this.watchdogState = 'freeze';
        this.freezeTriggered = true;
      } else if (age > HEARTBEAT_INTERVAL_MS * 2) {
        this.watchdogState = 'degraded';
      } else {
        this.watchdogState = 'stable';
        this.freezeTriggered = false;
      }
      this.emit();
    }, HEARTBEAT_INTERVAL_MS);

    this.emit();
  }

  stopWatchdog(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatMonitorTimer) clearInterval(this.heartbeatMonitorTimer);
    this.heartbeatTimer = null;
    this.heartbeatMonitorTimer = null;
    this.heartbeatSend = undefined;
    this.watchdogState = 'idle';
    this.lastPongAt = null;
    this.lastHeartbeatSeq = null;
    this.freezeTriggered = false;
    this.autoDisarmed = false;
    this.emit();
  }

  ingestHeartbeat(frame: Partial<HeartbeatFrame>): void {
    this.lastPongAt = performance.now();
    if (typeof frame.seq === 'number') this.lastHeartbeatSeq = frame.seq;
    if (this.watchdogState !== 'disarmed') this.watchdogState = 'stable';
    this.freezeTriggered = false;
    this.emit();
  }

  recordClockSync(sample: ClockSyncSample): number {
    this.clockOffsetMs = calculateClockOffset(sample);
    this.emit();
    return this.clockOffsetMs;
  }

  getSnapshot(): PhysicalRuntimeSnapshot {
    const now = performance.now();
    const heartbeatAgeMs = this.lastPongAt === null ? null : now - this.lastPongAt;
    const commandCounts = {
      intent: 0,
      queued: 0,
      sent: 0,
      acked: 0,
      armed: 0,
      fired: 0,
      confirmed: 0,
      done: 0,
      failed: 0,
    } satisfies Record<PhysicalState, number>;

    const activeCommands: PhysicalCommandRecord[] = [];
    for (const command of this.commands.values()) {
      commandCounts[command.state] += 1;
      if (command.state !== 'done' && command.state !== 'failed') activeCommands.push({ ...command, history: [...command.history] });
    }

    return {
      watchdogState: this.watchdogState,
      systemArmed: this.systemArmed,
      freezeTriggered: this.freezeTriggered,
      autoDisarmed: this.autoDisarmed,
      hilModeEnabled: this.hilModeEnabled,
      hilProfile: { ...this.hilProfile },
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      heartbeatAgeMs,
      lastHeartbeatSeq: this.lastHeartbeatSeq,
      clockOffsetMs: this.clockOffsetMs,
      estimatedHardwareTime: now + this.clockOffsetMs,
      totalCommands: this.commands.size,
      commandCounts,
      activeCommands,
    };
  }
}

export const bridgePhysicalController = new BridgePhysicalController();

export interface HilFaultProfile {
  jitterMs: number;
  baseDelayMs: number;
  packetLossRate: number;
  reorderRate: number;
}

export class HilBridgeHarness {
  constructor(private profile: HilFaultProfile = { jitterMs: 15, baseDelayMs: 40, packetLossRate: 0, reorderRate: 0 }) {}

  async fire(channelId: string, onAcknowledge: (channel: string, meta: { delayMs: number; reordered: boolean }) => void): Promise<boolean> {
    if (Math.random() < this.profile.packetLossRate) return false;
    const jitter = (Math.random() - 0.5) * 2 * this.profile.jitterMs;
    const reordered = Math.random() < this.profile.reorderRate;
    const reorderPenalty = reordered ? this.profile.baseDelayMs : 0;
    const delay = Math.max(0, this.profile.baseDelayMs + jitter + reorderPenalty);
    await new Promise((resolve) => setTimeout(resolve, delay));
    onAcknowledge(channelId, { delayMs: delay, reordered });
    return true;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function computeHilDrift(report: Pick<HilRunReport, 'logs'>): HilDriftHistogram {
  const samples = report.logs
    .filter((entry) => entry.event === 'ack' || entry.event === 'reorder')
    .map((entry) => entry.delayMs ?? 0)
    .filter((value) => Number.isFinite(value));

  if (samples.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, buckets: [] };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const max = sorted[sorted.length - 1];
  const bucketSize = Math.max(10, Math.ceil(max / 8));
  const buckets: HilDriftHistogram['buckets'] = [];
  const bucketCount = Math.max(1, Math.floor(max / bucketSize) + 1);
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ rangeMs: [i * bucketSize, (i + 1) * bucketSize], count: 0 });
  }
  for (const v of sorted) {
    const idx = Math.min(buckets.length - 1, Math.floor(v / bucketSize));
    buckets[idx].count += 1;
  }

  return {
    count: sorted.length,
    min: sorted[0],
    max,
    mean: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    buckets,
  };
}

export function compareHilReports(a: HilRunReport, b: HilRunReport): HilCompareResult {
  const driftA = computeHilDrift(a);
  const driftB = computeHilDrift(b);
  return {
    lossDelta: b.stats.failed - a.stats.failed,
    ackDelta: b.stats.acked - a.stats.acked,
    totalDelta: b.stats.total - a.stats.total,
    jitterP95Delta: driftB.p95 - driftA.p95,
    meanDelta: driftB.mean - driftA.mean,
  };
}

export function checkHilRegression(report: HilRunReport, rule: HilRegressionRule): HilRegressionResult {
  const drift = computeHilDrift(report);
  const ackRate = report.stats.total === 0 ? 1 : report.stats.acked / report.stats.total;
  const failures: string[] = [];
  if (rule.maxFailed !== undefined && report.stats.failed > rule.maxFailed) {
    failures.push(`failed ${report.stats.failed} > ${rule.maxFailed}`);
  }
  if (rule.maxP95Ms !== undefined && drift.p95 > rule.maxP95Ms) {
    failures.push(`p95 ${drift.p95.toFixed(1)}ms > ${rule.maxP95Ms}ms`);
  }
  if (rule.maxAbsoluteMs !== undefined && drift.max > rule.maxAbsoluteMs) {
    failures.push(`max ${drift.max.toFixed(1)}ms > ${rule.maxAbsoluteMs}ms`);
  }
  if (rule.minAckRate !== undefined && ackRate < rule.minAckRate) {
    failures.push(`ackRate ${(ackRate * 100).toFixed(1)}% < ${(rule.minAckRate * 100).toFixed(1)}%`);
  }
  return {
    passed: failures.length === 0,
    failures,
    metrics: { failed: report.stats.failed, p95: drift.p95, max: drift.max, ackRate },
  };
}

export interface HilReplayHandle {
  cancel: () => void;
  scheduled: number;
}

export function replayHilReport(
  report: HilRunReport,
  fire: (channel: string, entry: CommandTimeline) => void,
): HilReplayHandle {
  const t0 = report.runStart;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let scheduled = 0;
  const ordered = [...report.timeline]
    .filter((entry) => entry.sentAt !== undefined)
    .sort((a, b) => (a.sentAt! - b.sentAt!));
  for (const entry of ordered) {
    if (entry.sentAt === undefined) continue;
    const delay = Math.max(0, entry.sentAt - t0);
    scheduled += 1;
    timers.push(setTimeout(() => fire(entry.channel, entry), delay));
  }
  return {
    scheduled,
    cancel: () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
    },
  };
}
