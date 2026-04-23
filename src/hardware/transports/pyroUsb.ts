import {
  buildArmFrame,
  buildBatteryQuery,
  buildCueStatusQuery,
  buildDisarmFrame,
  buildEStopFrame,
  buildFireFrame,
  buildFireSequenceFrame,
  buildStatusQuery,
} from '@/lib/pbusProtocol';
import { getFireOneController } from '@/lib/fireoneProtocol';

export const PYRO_USB_DEFAULT_LATENCY_MS = 12;
const DEFAULT_WATCHDOG_TIMEOUT_MS = 250;

export interface PyroUsbPortAdapter {
  send(frame: Uint8Array): Promise<void>;
  isConnected?(): boolean;
}

export interface PyroUsbTransportOptions {
  watchdogTimeoutMs?: number;
  autoLockoutOnWatchdog?: boolean;
}

export type PyroUsbTransportState = 'disconnected' | 'idle' | 'armed' | 'lockout' | 'fault';
export type PyroUsbLockoutReason = 'manual' | 'watchdog' | 'estop' | 'fault';

export type PyroUsbEvent =
  | { type: 'state-change'; from: PyroUsbTransportState; to: PyroUsbTransportState; timestamp: number }
  | { type: 'armed-invalidated'; timestamp: number }
  | { type: 'watchdog-fired'; timestamp: number }
  | { type: 'fault'; reason: string; timestamp: number };

export type PyroUsbEventListener = (event: PyroUsbEvent) => void;

export type PyroUsbScheduledPayload =
  | { command: 'arm'; moduleAddress: number }
  | { command: 'disarm'; moduleAddress: number }
  | { command: 'fire'; moduleAddress: number; cueIndex: number; durationMs?: number }
  | { command: 'fire-sequence'; moduleAddress: number; cueIndices: number[]; intervalMs?: number }
  | { command: 'status'; moduleAddress: number }
  | { command: 'cue-status'; moduleAddress: number }
  | { command: 'battery'; moduleAddress: number }
  | { command: 'estop' };

export interface PyroUsbTransportDiagnostics {
  connectionState: 'bound' | 'disconnected';
  state: PyroUsbTransportState;
  lockoutReason: PyroUsbLockoutReason | null;
  armedModules: ReadonlyArray<number>;
  adapterType: 'pbus' | 'fireone';
  lastCommandAt: number | null;
  lastArmAt: number | null;
  lastFireAt: number | null;
  lastWatchdogKickAt: number | null;
  watchdogTimeoutMs: number;
  watchdogExpired: boolean;
}

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

export class PyroUsbTransport {
  private adapter: PyroUsbPortAdapter | null = null;
  private readonly fireOneController = getFireOneController();
  private readonly armedModules = new Set<number>();
  private readonly watchdogTimeoutMs: number;
  private readonly autoLockoutOnWatchdog: boolean;
  private state: PyroUsbTransportState = 'disconnected';
  private lockoutReason: PyroUsbLockoutReason | null = null;
  private lastCommandAt: number | null = null;
  private lastArmAt: number | null = null;
  private lastFireAt: number | null = null;
  private lastWatchdogKickAt: number | null = null;
  private watchdogTimerId: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<PyroUsbEventListener>();

  constructor(adapter?: PyroUsbPortAdapter | null, options: PyroUsbTransportOptions = {}) {
    this.watchdogTimeoutMs = options.watchdogTimeoutMs ?? DEFAULT_WATCHDOG_TIMEOUT_MS;
    this.autoLockoutOnWatchdog = options.autoLockoutOnWatchdog ?? true;

    if (adapter) {
      this.bindAdapter(adapter);
    }
  }

  /**
   * Bind a transport adapter. Reconnection = NEW SESSION.
   * Any previously armed modules are INVALIDATED — operator must
   * explicitly re-arm after a re-bind. This prevents "phantom armed"
   * state surviving a cable disconnect/reconnect cycle.
   */
  bindAdapter(adapter: PyroUsbPortAdapter): void {
    const hadArmed = this.armedModules.size > 0;
    this.adapter = adapter;
    // SAFETY: never preserve armed state across adapter binds
    this.armedModules.clear();
    this.lastWatchdogKickAt = null;
    // If previous state was lockout/fault, keep it — operator must clearLockout()
    if (this.state !== 'lockout' && this.state !== 'fault') {
      this.state = 'idle';
    }
    if (hadArmed) {
      this.emitEvent({ type: 'armed-invalidated', timestamp: Date.now() });
    }
    this.startWatchdogTimer();
  }

  unbindAdapter(): void {
    this.stopWatchdogTimer();
    this.adapter = null;
    this.armedModules.clear();
    this.lockoutReason = null;
    this.lastWatchdogKickAt = null;
    this.state = 'disconnected';
  }

  isConnected(): boolean {
    return this.adapter
      ? (this.adapter.isConnected?.() ?? true)
      : this.fireOneController.isConnected;
  }

  async dispatch(payload: PyroUsbScheduledPayload, nowMs = Date.now()): Promise<void> {
    switch (payload.command) {
      case 'arm':
        await this.arm(payload.moduleAddress, nowMs);
        return;
      case 'disarm':
        await this.disarm(payload.moduleAddress, nowMs);
        return;
      case 'fire':
        await this.fire(payload.moduleAddress, payload.cueIndex, payload.durationMs, nowMs);
        return;
      case 'fire-sequence':
        await this.fireSequence(payload.moduleAddress, payload.cueIndices, payload.intervalMs, nowMs);
        return;
      case 'status':
        await this.sendFrame(buildStatusQuery(this.validateModuleAddress(payload.moduleAddress)), nowMs);
        return;
      case 'cue-status':
        await this.sendFrame(buildCueStatusQuery(this.validateModuleAddress(payload.moduleAddress)), nowMs);
        return;
      case 'battery':
        await this.sendFrame(buildBatteryQuery(this.validateModuleAddress(payload.moduleAddress)), nowMs);
        return;
      case 'estop':
        await this.emergencyStop('estop', nowMs);
        return;
    }
  }

  async arm(moduleAddress: number, nowMs = Date.now()): Promise<void> {
    this.assertNoLockout();
    const addr = this.validateModuleAddress(moduleAddress);
    await this.sendFrame(buildArmFrame(addr), nowMs);
    this.armedModules.add(addr);
    this.lastArmAt = nowMs;
    this.lastWatchdogKickAt = nowMs;
    this.state = 'armed';
  }

  async disarm(moduleAddress: number, nowMs = Date.now()): Promise<void> {
    const addr = this.validateModuleAddress(moduleAddress);
    await this.sendFrame(buildDisarmFrame(addr), nowMs);
    this.armedModules.delete(addr);
    if (this.armedModules.size === 0 && this.state !== 'lockout') {
      this.state = this.isConnected() ? 'idle' : 'disconnected';
    }
  }

  async fire(moduleAddress: number, cueIndex: number, durationMs = 500, nowMs = Date.now()): Promise<void> {
    this.assertCanFire(moduleAddress);
    const addr = this.validateModuleAddress(moduleAddress);
    const cue = this.validateCueIndex(cueIndex);
    const duration = this.validateDurationMs(durationMs);
    await this.sendFire(addr, cue, duration, nowMs);
    this.lastFireAt = nowMs;
    this.lastWatchdogKickAt = nowMs;
  }

  async fireSequence(moduleAddress: number, cueIndices: number[], intervalMs = 10, nowMs = Date.now()): Promise<void> {
    this.assertCanFire(moduleAddress);
    const addr = this.validateModuleAddress(moduleAddress);
    const cues = cueIndices.map((cueIndex) => this.validateCueIndex(cueIndex));
    if (cues.length === 0) {
      throw new Error('Pyro fire sequence requires at least one cue');
    }
    const interval = this.validateDurationMs(intervalMs);
    await this.sendFireSequence(addr, cues, interval, nowMs);
    this.lastFireAt = nowMs;
    this.lastWatchdogKickAt = nowMs;
  }

  kickWatchdog(nowMs = Date.now()): void {
    if (this.armedModules.size === 0) return;
    this.lastWatchdogKickAt = nowMs;
  }

  async serviceWatchdog(nowMs = Date.now()): Promise<boolean> {
    if (this.armedModules.size === 0 || this.lastWatchdogKickAt === null) {
      return false;
    }

    if (nowMs - this.lastWatchdogKickAt <= this.watchdogTimeoutMs) {
      return false;
    }

    await this.emergencyStop('watchdog', nowMs);
    return true;
  }

  async enableLockout(reason: PyroUsbLockoutReason = 'manual', nowMs = Date.now()): Promise<void> {
    this.lockoutReason = reason;
    this.state = 'lockout';
    if (this.armedModules.size > 0) {
      await this.sendFrame(buildEStopFrame(), nowMs);
      this.armedModules.clear();
    }
  }

  clearLockout(): void {
    this.lockoutReason = null;
    this.state = this.isConnected() ? 'idle' : 'disconnected';
  }

  async emergencyStop(reason: PyroUsbLockoutReason = 'estop', nowMs = Date.now()): Promise<void> {
    await this.sendFrame(buildEStopFrame(), nowMs);
    this.armedModules.clear();
    if (this.autoLockoutOnWatchdog || reason !== 'watchdog') {
      this.lockoutReason = reason;
      this.state = 'lockout';
      return;
    }
    this.state = this.isConnected() ? 'idle' : 'disconnected';
  }

  reset(): void {
    this.armedModules.clear();
    this.lockoutReason = null;
    this.lastCommandAt = null;
    this.lastArmAt = null;
    this.lastFireAt = null;
    this.lastWatchdogKickAt = null;
    this.state = this.isConnected() ? 'idle' : 'disconnected';
  }

  getState(): PyroUsbTransportState {
    return this.state;
  }

  getDiagnostics(nowMs = Date.now()): Readonly<PyroUsbTransportDiagnostics> {
    const watchdogExpired = this.lastWatchdogKickAt !== null
      && this.armedModules.size > 0
      && nowMs - this.lastWatchdogKickAt > this.watchdogTimeoutMs;

    return deepFreeze({
      connectionState: this.isConnected() ? 'bound' : 'disconnected',
      state: this.state,
      lockoutReason: this.lockoutReason,
      armedModules: Array.from(this.armedModules.values()).sort((a, b) => a - b),
      adapterType: this.usesFireOneAdapter() ? 'fireone' : 'pbus',
      lastCommandAt: this.lastCommandAt,
      lastArmAt: this.lastArmAt,
      lastFireAt: this.lastFireAt,
      lastWatchdogKickAt: this.lastWatchdogKickAt,
      watchdogTimeoutMs: this.watchdogTimeoutMs,
      watchdogExpired,
    });
  }

  isModuleArmed(moduleAddress: number): boolean {
    const addr = this.validateModuleAddress(moduleAddress);
    return this.armedModules.has(addr);
  }

  private usesFireOneAdapter(): boolean {
    return this.adapter === null;
  }

  private async sendFire(moduleAddress: number, cueIndex: number, durationMs: number, nowMs: number): Promise<void> {
    if (this.usesFireOneAdapter()) {
      await this.sendViaFireOne(moduleAddress, cueIndex + 1, durationMs, nowMs);
      return;
    }

    await this.sendFrame(buildFireFrame(moduleAddress, cueIndex, durationMs), nowMs);
  }

  private async sendFireSequence(moduleAddress: number, cueIndices: number[], intervalMs: number, nowMs: number): Promise<void> {
    if (this.usesFireOneAdapter()) {
      await this.fireOneController.fireSequence(moduleAddress, cueIndices.map((cue) => cue + 1), intervalMs);
      this.lastCommandAt = nowMs;
      return;
    }

    await this.sendFrame(buildFireSequenceFrame(moduleAddress, cueIndices, intervalMs), nowMs);
  }

  private async sendViaFireOne(moduleAddress: number, igniterPosition: number, durationMs: number, nowMs: number): Promise<void> {
    if (!this.fireOneController.isConnected) {
      this.state = 'disconnected';
      throw new Error('Pyro USB transport is not connected');
    }

    try {
      await this.fireOneController.fireIgniter(moduleAddress, igniterPosition, durationMs);
      this.lastCommandAt = nowMs;
    } catch (error) {
      this.lockoutReason = 'fault';
      this.state = 'fault';
      throw error;
    }
  }

  private async sendFrame(frame: Uint8Array, nowMs: number): Promise<void> {
    if (!this.isConnected() || !this.adapter) {
      this.state = 'disconnected';
      throw new Error('Pyro USB transport is not connected');
    }

    try {
      await this.adapter.send(frame);
      this.lastCommandAt = nowMs;
    } catch (error) {
      this.lockoutReason = 'fault';
      this.state = 'fault';
      throw error;
    }
  }

  private assertCanFire(moduleAddress: number): void {
    this.assertNoLockout();
    const addr = this.validateModuleAddress(moduleAddress);
    if (!this.armedModules.has(addr)) {
      throw new Error(`Pyro module ${addr} must be armed before fire`);
    }
  }

  private assertNoLockout(): void {
    if (this.lockoutReason !== null || this.state === 'lockout') {
      throw new Error(`Pyro transport lockout active (${this.lockoutReason ?? 'manual'})`);
    }
  }

  private validateModuleAddress(moduleAddress: number): number {
    if (!Number.isInteger(moduleAddress) || moduleAddress < 0 || moduleAddress > 255) {
      throw new Error('Pyro module address must be an integer between 0 and 255');
    }
    return moduleAddress;
  }

  private validateCueIndex(cueIndex: number): number {
    if (!Number.isInteger(cueIndex) || cueIndex < 0 || cueIndex > 255) {
      throw new Error('Pyro cue index must be an integer between 0 and 255');
    }
    return cueIndex;
  }

  private validateDurationMs(durationMs: number): number {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 65_535) {
      throw new Error('Pyro duration must be a finite number between 1 and 65535 ms');
    }
    return Math.round(durationMs);
  }
}

export const pyroUsbTransport = new PyroUsbTransport();