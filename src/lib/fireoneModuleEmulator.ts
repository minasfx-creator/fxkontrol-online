/**
 * FireOne IFMx-i32Q Virtual Module Emulator
 * 
 * Turns a browser/phone into a fully functional field module that speaks
 * the FireOne protocol. When paired with an ESP32 hardware bridge,
 * can perform real firings via CDS (Capacitive Discharge System).
 * 
 * State machine: IDLE → SAFE_SENSE → READY → ARMED → FIRING
 * Protocol: STX(0x02) CMD PAYLOAD ETX(0x03) with ACK/NAK responses
 */

export type ModuleState = 'idle' | 'safe_sense' | 'ready' | 'armed' | 'firing' | 'error';

export interface IgniterChannel {
  pin: number;            // 0–31
  connected: boolean;     // continuity detected
  fired: boolean;
  resistance: number;     // ohms (0 = open, <50 = good, >200 = marginal)
  cdsVoltage: number;     // capacitor voltage (0–12V)
  cdsCharging: boolean;
  lastFireTime: number;   // timestamp ms
  fireDuration: number;   // last fire duration ms
}

export interface ModuleStatus {
  state: ModuleState;
  address: number;        // 01–99
  igniters: IgniterChannel[];
  batteryVoltage: number;
  signalStrength: number; // dBm (-30 to -90)
  firePowerOn: boolean;
  communicating: boolean;
  rfActive: boolean;
  charging: boolean;
  errorCode: number;
  safeSenseProgress: number; // 0–100
  totalFired: number;
  uptime: number;         // seconds
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

const CDS_TARGET_VOLTAGE = 11.5;  // Target cap charge voltage
const CDS_CHARGE_RATE = 0.8;      // V per second
const CDS_MIN_FIRE_VOLTAGE = 8.0; // Minimum voltage to fire
const SAFE_SENSE_DURATION = 3000; // 3 seconds
const MAX_FIRE_DURATION = 1000;   // 1000ms max
const MIN_FIRE_DURATION = 20;     // 20ms minimum

export type HardwareFireCallback = (pin: number, durationMs: number) => Promise<boolean>;
export type ContinuityReadCallback = (pin: number) => Promise<number>; // returns ohms

export interface ModuleEmulatorConfig {
  address?: number;
  onFire?: HardwareFireCallback;
  onContinuityRead?: ContinuityReadCallback;
  onStateChange?: (state: ModuleState) => void;
  onStatusUpdate?: (status: ModuleStatus) => void;
  simulateHardware?: boolean; // If true, simulate igniters without real hardware
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

  private onFire: HardwareFireCallback | null;
  private onContinuityRead: ContinuityReadCallback | null;
  private onStateChange: ((state: ModuleState) => void) | null;
  private onStatusUpdate: ((status: ModuleStatus) => void) | null;
  private simulateHardware: boolean;

  constructor(config: ModuleEmulatorConfig = {}) {
    this.address = config.address ?? 1;
    this.onFire = config.onFire ?? null;
    this.onContinuityRead = config.onContinuityRead ?? null;
    this.onStateChange = config.onStateChange ?? null;
    this.onStatusUpdate = config.onStatusUpdate ?? null;
    this.simulateHardware = config.simulateHardware ?? true;

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
  }

  /** Power on — starts safe-sense sequence */
  powerOn(): void {
    if (this.state !== 'idle') return;
    this.setState('safe_sense');
    this.safeSenseProgress = 0;
    this.communicating = true;

    // Safe-sense: 3-second ramp (per IFMx manual)
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

  /** Power off */
  powerOff(): void {
    this.stopCharging();
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

  /** ARM the module — enables fire power */
  arm(): boolean {
    if (this.state !== 'ready') return false;
    this.firePowerOn = true;
    this.setState('armed');
    this.emitStatus();
    return true;
  }

  /** DISARM — disable fire power */
  disarm(): void {
    if (this.state === 'armed' || this.state === 'firing') {
      this.firePowerOn = false;
      this.setState('ready');
      this.emitStatus();
    }
  }

  /** EMERGENCY STOP — immediate disarm + discharge all caps */
  eStop(): void {
    this.firePowerOn = false;
    this.stopCharging();
    this.igniters.forEach(ig => {
      ig.cdsVoltage = 0;
      ig.cdsCharging = false;
    });
    this.setState('ready');
    this.emitStatus();
  }

  /** Fire a single igniter channel */
  async fire(pin: number, durationMs: number): Promise<boolean> {
    if (this.state !== 'armed') return false;
    if (pin < 0 || pin > 31) return false;

    const dur = Math.max(MIN_FIRE_DURATION, Math.min(MAX_FIRE_DURATION, durationMs));
    const ig = this.igniters[pin];

    if (ig.fired) return false; // Already fired
    if (ig.cdsVoltage < CDS_MIN_FIRE_VOLTAGE) return false; // Insufficient charge

    this.setState('firing');

    // Route to hardware if available
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
      ig.cdsVoltage = 0; // Cap discharged
      ig.lastFireTime = Date.now();
      ig.fireDuration = dur;
      this.totalFired++;
    }

    // Return to armed state after fire
    setTimeout(() => {
      if (this.state === 'firing') {
        this.setState('armed');
        this.emitStatus();
      }
    }, dur + 50);

    this.emitStatus();
    return hardwareSuccess;
  }

  /** Fire multiple pins simultaneously */
  async fireGroup(pins: number[], durationMs: number): Promise<boolean[]> {
    return Promise.all(pins.map(p => this.fire(p, durationMs)));
  }

  /** Read continuity for a channel */
  async readContinuity(pin: number): Promise<number> {
    if (pin < 0 || pin > 31) return 0;
    
    if (this.onContinuityRead) {
      const ohms = await this.onContinuityRead(pin);
      this.igniters[pin].resistance = ohms;
      this.igniters[pin].connected = ohms > 0 && ohms < 200;
      this.emitStatus();
      return ohms;
    }

    // Simulated
    return this.igniters[pin].resistance;
  }

  /** Read all continuities */
  async readAllContinuity(): Promise<number[]> {
    return Promise.all(this.igniters.map((_, i) => this.readContinuity(i)));
  }

  /** Set module address (01–99) */
  setAddress(addr: number): void {
    this.address = Math.max(1, Math.min(99, Math.floor(addr)));
    this.emitStatus();
  }

  /** Handle incoming protocol frame from controller */
  handleFrame(cmd: number, payload: Uint8Array): Uint8Array {
    switch (cmd) {
      case CMD.IDENTIFY:
        return this.buildResponse(CMD.ACK, new Uint8Array([this.address, 0x32])); // 0x32 = 32 channels

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
          const mask = (payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3];
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

  /** Get current status snapshot */
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
    };
  }

  /** Cleanup */
  destroy(): void {
    this.stopCharging();
    if (this.safeSenseTimer) clearTimeout(this.safeSenseTimer);
  }

  // ─── Private ─────────────────────────────────────────────

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
      // Simulate battery drain
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
    frame[0] = 0x02; // STX
    frame[1] = cmd;
    frame.set(data, 2);
    frame[frame.length - 1] = 0x03; // ETX
    return frame;
  }

  private buildStatusResponse(): Uint8Array {
    const stateMap: Record<ModuleState, number> = {
      idle: 0, safe_sense: 1, ready: 2, armed: 3, firing: 4, error: 5,
    };
    const data = new Uint8Array(8);
    data[0] = this.address;
    data[1] = stateMap[this.state];
    data[2] = Math.round(this.batteryVoltage * 10);
    data[3] = Math.abs(this.signalStrength);
    // Continuity bitmap (32 bits = 4 bytes)
    let mask = 0;
    this.igniters.forEach(ig => {
      if (ig.connected && !ig.fired) mask |= (1 << ig.pin);
    });
    data[4] = (mask >> 24) & 0xFF;
    data[5] = (mask >> 16) & 0xFF;
    data[6] = (mask >> 8) & 0xFF;
    data[7] = mask & 0xFF;
    return this.buildResponse(CMD.STATUS, data);
  }

  private buildCdsResponse(): Uint8Array {
    const data = new Uint8Array(32);
    this.igniters.forEach((ig, i) => {
      data[i] = Math.round(ig.cdsVoltage * 10); // tenths of volt
    });
    return this.buildResponse(CMD.CDS_STATUS, data);
  }
}
