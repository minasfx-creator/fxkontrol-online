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
    this.emit();
  }

  async simulateHilFire(channelId: string, onAcknowledge: (channel: string) => void): Promise<boolean> {
    return this.hilHarness.fire(channelId, onAcknowledge);
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

  async fire(channelId: string, onAcknowledge: (channel: string) => void): Promise<boolean> {
    if (Math.random() < this.profile.packetLossRate) return false;
    const jitter = (Math.random() - 0.5) * 2 * this.profile.jitterMs;
    const reorderPenalty = Math.random() < this.profile.reorderRate ? this.profile.baseDelayMs : 0;
    const delay = Math.max(0, this.profile.baseDelayMs + jitter + reorderPenalty);
    await new Promise((resolve) => setTimeout(resolve, delay));
    onAcknowledge(channelId);
    return true;
  }
}
