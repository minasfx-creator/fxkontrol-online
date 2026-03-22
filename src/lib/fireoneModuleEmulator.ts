/**
 * FireOne IFMx-i32Q Virtual Module Emulator
 * 
 * Turns a browser/phone into a fully functional field module that speaks
 * the FireOne protocol. When paired with an ESP32 hardware bridge,
 * can perform real firings via CDS (Capacitive Discharge System).
 * 
 * State machine: IDLE → SAFE_SENSE → READY → ARMED → FIRING
 * Firing modes: Manual, Semi-Auto, Auto (Timecode), UltraFire
 */

export type ModuleState = 'idle' | 'safe_sense' | 'ready' | 'armed' | 'firing' | 'error' | 'estop_lockout';

export type FiringMode = 'manual' | 'semi_auto' | 'auto' | 'ultrafire' | 'preset';

export interface IgniterChannel {
  pin: number;
  connected: boolean;
  fired: boolean;
  resistance: number;
  cdsVoltage: number;
  cdsCharging: boolean;
  lastFireTime: number;
  fireDuration: number;
}

export interface ScriptEvent {
  id: string;
  pins: number[];
  duration: number;
  timeMs: number;       // absolute time offset for auto mode
  label?: string;
}

export interface UltraFireSlot {
  slot: number;         // 1–8
  events: ScriptEvent[];
  verifyCode: string;
  loaded: boolean;
}

export interface ModuleStatus {
  state: ModuleState;
  address: number;
  igniters: IgniterChannel[];
  batteryVoltage: number;
  signalStrength: number;
  firePowerOn: boolean;
  communicating: boolean;
  rfActive: boolean;
  charging: boolean;
  errorCode: number;
  safeSenseProgress: number;
  totalFired: number;
  uptime: number;
  firingMode: FiringMode;
  // Semi-auto
  semiAutoEvents: ScriptEvent[];
  semiAutoIndex: number;
  // Auto
  autoRunning: boolean;
  autoElapsedMs: number;
  autoTotalMs: number;
  // UltraFire
  ultraSlots: UltraFireSlot[];
  ultraActiveSlot: number;
  ultraRunning: boolean;
  // Preset
  presetPins: number[];
  // E-STOP lockout
  estopLockoutEnd: number;
}

// Protocol command bytes
const CMD = {
  IDENTIFY:   0x01,
  STATUS:     0x02,
  ARM:        0x10,
  DISARM:     0x11,
  FIRE:       0x20,
  FIRE_GROUP: 0x21,
  CONTINUITY: 0x30,
  E_STOP:     0xFF,
  ACK:        0x06,
  NAK:        0x15,
  SET_ADDR:   0x40,
  CDS_STATUS: 0x50,
} as const;

const CDS_TARGET_VOLTAGE = 11.5;
const CDS_CHARGE_RATE = 0.8;
const CDS_MIN_FIRE_VOLTAGE = 8.0;
const SAFE_SENSE_DURATION = 3000;
const MAX_FIRE_DURATION = 1000;
const MIN_FIRE_DURATION = 20;
const ESTOP_LOCKOUT_MS = 3000;
const FIRE_GROUP_STAGGER_MS = 2;

export type HardwareFireCallback = (pin: number, durationMs: number) => Promise<boolean>;
export type ContinuityReadCallback = (pin: number) => Promise<number>;

export type HardwareMode = 'cds' | 'direct_relay';

export interface ModuleEmulatorConfig {
  address?: number;
  onFire?: HardwareFireCallback;
  onContinuityRead?: ContinuityReadCallback;
  onStateChange?: (state: ModuleState) => void;
  onStatusUpdate?: (status: ModuleStatus) => void;
  simulateHardware?: boolean;
  hardwareMode?: HardwareMode;
}

export class FireOneModuleEmulator {
  private state: ModuleState = 'idle';
  private address: number;
  private igniters: IgniterChannel[] = [];
  private batteryVoltage = 12.6;
  private signalStrength = -45;
  private firePowerOn = false;
  private communicating = false;
  private rfActive = false;
  private charging = false;
  private errorCode = 0;
  private safeSenseProgress = 0;
  private totalFired = 0;
  private startTime = Date.now();
  private chargeInterval: ReturnType<typeof setInterval> | null = null;
  private safeSenseTimer: ReturnType<typeof setTimeout> | null = null;

  // Firing modes
  private firingMode: FiringMode = 'manual';
  private semiAutoEvents: ScriptEvent[] = [];
  private semiAutoIndex = 0;
  private autoEvents: ScriptEvent[] = [];
  private autoRunning = false;
  private autoStartTime = 0;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private ultraSlots: UltraFireSlot[] = [];
  private ultraActiveSlot = 0;
  private ultraRunning = false;
  private ultraTimer: ReturnType<typeof setInterval> | null = null;
  private presetPins: number[] = [];
  private estopLockoutEnd = 0;

  // Dynamic callbacks (can be updated after construction)
  onFire: HardwareFireCallback | null;
  onContinuityRead: ContinuityReadCallback | null;
  private onStateChange: ((state: ModuleState) => void) | null;
  private onStatusUpdate: ((status: ModuleStatus) => void) | null;
  private simulateHardware: boolean;
  private hardwareMode: HardwareMode;

  constructor(config: ModuleEmulatorConfig = {}) {
    this.address = config.address ?? 1;
    this.onFire = config.onFire ?? null;
    this.onContinuityRead = config.onContinuityRead ?? null;
    this.onStateChange = config.onStateChange ?? null;
    this.onStatusUpdate = config.onStatusUpdate ?? null;
    this.simulateHardware = config.simulateHardware ?? true;
    this.hardwareMode = config.hardwareMode ?? 'cds';

    // Initialize 32 igniter channels
    for (let i = 0; i < 32; i++) {
      this.igniters.push({
        pin: i,
        connected: this.simulateHardware ? Math.random() > 0.3 : false,
        fired: false,
        resistance: this.simulateHardware ? (Math.random() > 0.3 ? 1.5 + Math.random() * 3 : 0) : 0,
        cdsVoltage: 0,
        cdsCharging: false,
        lastFireTime: 0,
        fireDuration: 0,
      });
    }

    // Initialize 8 UltraFire slots
    for (let s = 1; s <= 8; s++) {
      this.ultraSlots.push({ slot: s, events: [], verifyCode: '', loaded: false });
    }
  }

  // ─── Power ──────────────────────────────────────────────

  powerOn(): void {
    if (this.state !== 'idle') return;
    this.setState('safe_sense');
    this.safeSenseProgress = 0;
    this.communicating = true;

    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      this.safeSenseProgress = Math.min(100, (elapsed / SAFE_SENSE_DURATION) * 100);
      this.emitStatus();

      if (elapsed >= SAFE_SENSE_DURATION) {
        this.setState('ready');
        this.startCharging();
      } else {
        this.safeSenseTimer = setTimeout(tick, 100);
      }
    };
    this.safeSenseTimer = setTimeout(tick, 100);
  }

  powerOff(): void {
    this.stopCharging();
    this.stopAuto();
    this.stopUltraFire();
    if (this.safeSenseTimer) clearTimeout(this.safeSenseTimer);
    this.setState('idle');
    this.firePowerOn = false;
    this.communicating = false;
    this.igniters.forEach(ig => {
      ig.cdsVoltage = 0;
      ig.cdsCharging = false;
    });
    this.emitStatus();
  }

  // ─── ARM / DISARM ───────────────────────────────────────

  arm(): boolean {
    if (this.state !== 'ready') return false;
    // Check E-STOP lockout
    if (Date.now() < this.estopLockoutEnd) return false;
    this.firePowerOn = true;
    this.setState('armed');
    this.emitStatus();
    return true;
  }

  disarm(): void {
    if (this.state === 'armed' || this.state === 'firing') {
      this.firePowerOn = false;
      this.stopAuto();
      this.stopUltraFire();
      this.setState('ready');
      this.emitStatus();
    }
  }

  // ─── E-STOP (goes to idle, 3s lockout) ──────────────────

  eStop(): void {
    this.firePowerOn = false;
    this.stopCharging();
    this.stopAuto();
    this.stopUltraFire();
    this.igniters.forEach(ig => {
      ig.cdsVoltage = 0;
      ig.cdsCharging = false;
    });
    this.estopLockoutEnd = Date.now() + ESTOP_LOCKOUT_MS;
    this.setState('estop_lockout');

    // After lockout, return to idle
    setTimeout(() => {
      if (this.state === 'estop_lockout') {
        this.setState('idle');
        this.communicating = false;
        this.emitStatus();
      }
    }, ESTOP_LOCKOUT_MS);

    this.emitStatus();
  }

  // ─── Fire ───────────────────────────────────────────────

  async fire(pin: number, durationMs: number): Promise<boolean> {
    if (this.state !== 'armed') return false;
    if (pin < 0 || pin > 31) return false;

    const dur = Math.max(MIN_FIRE_DURATION, Math.min(MAX_FIRE_DURATION, durationMs));
    const ig = this.igniters[pin];

    if (ig.fired) return false;
    if (ig.cdsVoltage < CDS_MIN_FIRE_VOLTAGE) return false;

    this.setState('firing');

    let hardwareSuccess = true;
    if (this.onFire) {
      try {
        hardwareSuccess = await this.onFire(pin, dur);
      } catch {
        hardwareSuccess = false;
      }
    }

    if (hardwareSuccess) {
      ig.fired = true;
      ig.connected = false;
      ig.resistance = 0;
      ig.cdsVoltage = 0;
      ig.lastFireTime = Date.now();
      ig.fireDuration = dur;
      this.totalFired++;
    }

    setTimeout(() => {
      if (this.state === 'firing') {
        this.setState('armed');
        this.emitStatus();
      }
    }, dur + 50);

    this.emitStatus();
    return hardwareSuccess;
  }

  /** Fire multiple pins sequentially with 2ms stagger (simulates CDS current draw) */
  async fireGroup(pins: number[], durationMs: number): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const pin of pins) {
      const ok = await this.fire(pin, durationMs);
      results.push(ok);
      if (pins.indexOf(pin) < pins.length - 1) {
        await new Promise(r => setTimeout(r, FIRE_GROUP_STAGGER_MS));
      }
    }
    return results;
  }

  // ─── Continuity ─────────────────────────────────────────

  async readContinuity(pin: number): Promise<number> {
    if (pin < 0 || pin > 31) return 0;
    
    if (this.onContinuityRead) {
      const ohms = await this.onContinuityRead(pin);
      this.igniters[pin].resistance = ohms;
      this.igniters[pin].connected = ohms > 0 && ohms < 200;
      this.emitStatus();
      return ohms;
    }
    return this.igniters[pin].resistance;
  }

  async readAllContinuity(): Promise<number[]> {
    return Promise.all(this.igniters.map((_, i) => this.readContinuity(i)));
  }

  // ─── Address ────────────────────────────────────────────

  setAddress(addr: number): void {
    this.address = Math.max(1, Math.min(99, Math.floor(addr)));
    this.emitStatus();
  }

  // ─── Firing Modes ───────────────────────────────────────

  setFiringMode(mode: FiringMode): void {
    this.firingMode = mode;
    this.stopAuto();
    this.stopUltraFire();
    this.emitStatus();
  }

  getFiringMode(): FiringMode {
    return this.firingMode;
  }

  // ── Semi-Auto ──

  loadSemiAutoScript(events: ScriptEvent[]): void {
    this.semiAutoEvents = [...events];
    this.semiAutoIndex = 0;
    this.firingMode = 'semi_auto';
    this.emitStatus();
  }

  /** Fire the next event in semi-auto queue, returns false if done */
  async stepEvent(): Promise<boolean> {
    if (this.firingMode !== 'semi_auto') return false;
    if (this.semiAutoIndex >= this.semiAutoEvents.length) return false;
    if (this.state !== 'armed') return false;

    const event = this.semiAutoEvents[this.semiAutoIndex];
    await this.fireGroup(event.pins, event.duration);
    this.semiAutoIndex++;
    this.emitStatus();
    return this.semiAutoIndex < this.semiAutoEvents.length;
  }

  resetSemiAuto(): void {
    this.semiAutoIndex = 0;
    this.emitStatus();
  }

  // ── Auto (Timecode) ──

  loadAutoScript(events: ScriptEvent[]): void {
    this.autoEvents = [...events].sort((a, b) => a.timeMs - b.timeMs);
    this.firingMode = 'auto';
    this.autoRunning = false;
    this.emitStatus();
  }

  startAutoFire(): void {
    if (this.firingMode !== 'auto' || this.state !== 'armed') return;
    if (this.autoEvents.length === 0) return;

    this.autoRunning = true;
    this.autoStartTime = Date.now();
    let nextIndex = 0;

    this.autoTimer = setInterval(() => {
      const elapsed = Date.now() - this.autoStartTime;

      while (nextIndex < this.autoEvents.length && this.autoEvents[nextIndex].timeMs <= elapsed) {
        const ev = this.autoEvents[nextIndex];
        this.fireGroup(ev.pins, ev.duration);
        nextIndex++;
      }

      this.emitStatus();

      if (nextIndex >= this.autoEvents.length) {
        this.stopAuto();
      }
    }, 10); // 10ms resolution
    this.emitStatus();
  }

  stopAuto(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    this.autoRunning = false;
    this.emitStatus();
  }

  getAutoElapsedMs(): number {
    if (!this.autoRunning) return 0;
    return Date.now() - this.autoStartTime;
  }

  getAutoTotalMs(): number {
    if (this.autoEvents.length === 0) return 0;
    return this.autoEvents[this.autoEvents.length - 1].timeMs;
  }

  // ── UltraFire ──

  downloadScript(slot: number, events: ScriptEvent[], verifyCode: string): void {
    if (slot < 1 || slot > 8) return;
    const s = this.ultraSlots[slot - 1];
    s.events = [...events];
    s.verifyCode = verifyCode;
    s.loaded = true;
    this.emitStatus();
  }

  setUltraSlot(slot: number): void {
    if (slot < 1 || slot > 8) return;
    this.ultraActiveSlot = slot - 1;
    this.emitStatus();
  }

  startUltraFire(): void {
    if (this.firingMode !== 'ultrafire' || this.state !== 'armed') return;
    const slot = this.ultraSlots[this.ultraActiveSlot];
    if (!slot.loaded || slot.events.length === 0) return;

    this.ultraRunning = true;
    const startTime = Date.now();
    let nextIdx = 0;
    const sorted = [...slot.events].sort((a, b) => a.timeMs - b.timeMs);

    this.ultraTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      while (nextIdx < sorted.length && sorted[nextIdx].timeMs <= elapsed) {
        this.fireGroup(sorted[nextIdx].pins, sorted[nextIdx].duration);
        nextIdx++;
      }
      this.emitStatus();
      if (nextIdx >= sorted.length) {
        this.stopUltraFire();
      }
    }, 10);
    this.emitStatus();
  }

  stopUltraFire(): void {
    if (this.ultraTimer) {
      clearInterval(this.ultraTimer);
      this.ultraTimer = null;
    }
    this.ultraRunning = false;
    this.emitStatus();
  }

  // ── Preset ──

  setPreset(pins: number[]): void {
    this.presetPins = pins.filter(p => p >= 0 && p < 32);
    this.firingMode = 'preset';
    this.emitStatus();
  }

  async firePreset(): Promise<boolean[]> {
    if (this.presetPins.length === 0) return [];
    return this.fireGroup(this.presetPins, 200);
  }

  clearPreset(): void {
    this.presetPins = [];
    this.emitStatus();
  }

  // ─── Protocol Frame Handler ─────────────────────────────

  handleFrame(cmd: number, payload: Uint8Array): Uint8Array {
    switch (cmd) {
      case CMD.IDENTIFY:
        return this.buildResponse(CMD.ACK, new Uint8Array([this.address, 0x32]));

      case CMD.STATUS:
        return this.buildStatusResponse();

      case CMD.ARM:
        return new Uint8Array([this.arm() ? CMD.ACK : CMD.NAK]);

      case CMD.DISARM:
        this.disarm();
        return new Uint8Array([CMD.ACK]);

      case CMD.FIRE:
        if (payload.length >= 3) {
          const pin = payload[0];
          const dur = (payload[1] << 8) | payload[2];
          this.fire(pin, dur);
          return new Uint8Array([CMD.ACK]);
        }
        return new Uint8Array([CMD.NAK]);

      case CMD.FIRE_GROUP:
        if (payload.length >= 5) {
          const mask = ((payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]) >>> 0;
          const dur = (payload[4] << 8) | (payload[5] ?? 100);
          const pins: number[] = [];
          for (let i = 0; i < 32; i++) {
            if (mask & (1 << i)) pins.push(i);
          }
          this.fireGroup(pins, dur);
          return new Uint8Array([CMD.ACK]);
        }
        return new Uint8Array([CMD.NAK]);

      case CMD.CONTINUITY:
        if (payload.length >= 1) {
          this.readContinuity(payload[0]);
          return new Uint8Array([CMD.ACK]);
        }
        return new Uint8Array([CMD.NAK]);

      case CMD.E_STOP:
        this.eStop();
        return new Uint8Array([CMD.ACK]);

      case CMD.SET_ADDR:
        if (payload.length >= 1) {
          this.setAddress(payload[0]);
          return new Uint8Array([CMD.ACK]);
        }
        return new Uint8Array([CMD.NAK]);

      case CMD.CDS_STATUS:
        return this.buildCdsResponse();

      default:
        return new Uint8Array([CMD.NAK]);
    }
  }

  // ─── Status ─────────────────────────────────────────────

  getStatus(): ModuleStatus {
    return {
      state: this.state,
      address: this.address,
      igniters: [...this.igniters],
      batteryVoltage: this.batteryVoltage,
      signalStrength: this.signalStrength,
      firePowerOn: this.firePowerOn,
      communicating: this.communicating,
      rfActive: this.rfActive,
      charging: this.charging,
      errorCode: this.errorCode,
      safeSenseProgress: this.safeSenseProgress,
      totalFired: this.totalFired,
      uptime: (Date.now() - this.startTime) / 1000,
      firingMode: this.firingMode,
      semiAutoEvents: this.semiAutoEvents,
      semiAutoIndex: this.semiAutoIndex,
      autoRunning: this.autoRunning,
      autoElapsedMs: this.getAutoElapsedMs(),
      autoTotalMs: this.getAutoTotalMs(),
      ultraSlots: this.ultraSlots,
      ultraActiveSlot: this.ultraActiveSlot,
      ultraRunning: this.ultraRunning,
      presetPins: this.presetPins,
      estopLockoutEnd: this.estopLockoutEnd,
    };
  }

  destroy(): void {
    this.stopCharging();
    this.stopAuto();
    this.stopUltraFire();
    if (this.safeSenseTimer) clearTimeout(this.safeSenseTimer);
  }

  // ─── Private ────────────────────────────────────────────

  private setState(s: ModuleState): void {
    this.state = s;
    this.onStateChange?.(s);
  }

  private emitStatus(): void {
    this.onStatusUpdate?.(this.getStatus());
  }

  private startCharging(): void {
    this.charging = true;
    this.chargeInterval = setInterval(() => {
      let allCharged = true;
      this.igniters.forEach(ig => {
        if (ig.fired) return;
        if (ig.cdsVoltage < CDS_TARGET_VOLTAGE) {
          ig.cdsVoltage = Math.min(CDS_TARGET_VOLTAGE, ig.cdsVoltage + CDS_CHARGE_RATE * 0.5);
          ig.cdsCharging = true;
          allCharged = false;
        } else {
          ig.cdsCharging = false;
        }
      });
      this.batteryVoltage = Math.max(9.0, this.batteryVoltage - 0.001);
      if (allCharged) this.charging = false;
      this.emitStatus();
    }, 500);
  }

  private stopCharging(): void {
    if (this.chargeInterval) {
      clearInterval(this.chargeInterval);
      this.chargeInterval = null;
    }
    this.charging = false;
  }

  private buildResponse(cmd: number, data: Uint8Array): Uint8Array {
    const frame = new Uint8Array(data.length + 3);
    frame[0] = 0x02;
    frame[1] = cmd;
    frame.set(data, 2);
    frame[frame.length - 1] = 0x03;
    return frame;
  }

  private buildStatusResponse(): Uint8Array {
    const stateMap: Record<ModuleState, number> = {
      idle: 0, safe_sense: 1, ready: 2, armed: 3, firing: 4, error: 5, estop_lockout: 6,
    };
    const data = new Uint8Array(8);
    data[0] = this.address;
    data[1] = stateMap[this.state];
    data[2] = Math.round(this.batteryVoltage * 10);
    data[3] = Math.abs(this.signalStrength);
    // Continuity bitmap — use >>> 0 for unsigned 32-bit
    let mask = 0;
    this.igniters.forEach(ig => {
      if (ig.connected && !ig.fired) mask = (mask | (1 << ig.pin)) >>> 0;
    });
    data[4] = (mask >>> 24) & 0xFF;
    data[5] = (mask >>> 16) & 0xFF;
    data[6] = (mask >>> 8) & 0xFF;
    data[7] = mask & 0xFF;
    return this.buildResponse(CMD.STATUS, data);
  }

  private buildCdsResponse(): Uint8Array {
    const data = new Uint8Array(32);
    this.igniters.forEach((ig, i) => {
      data[i] = Math.round(ig.cdsVoltage * 10);
    });
    return this.buildResponse(CMD.CDS_STATUS, data);
  }
}
