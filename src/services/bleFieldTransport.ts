/**
 * BLE Field Transport — Web Bluetooth GATT for direct fire/ack between devices
 * Controller scans + connects to FXK module hardware via GATT
 */

// FXK Field Test BLE Service UUIDs
const FT_SERVICE_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
const FT_CMD_CHAR_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';   // Write: fire/arm/disarm/estop
const FT_RSP_CHAR_UUID = '0000ff03-0000-1000-8000-00805f9b34fb';   // Notify: ack/status
const FT_CDS_CHAR_UUID = '0000ff04-0000-1000-8000-00805f9b34fb';   // Notify: continuity

// Opcodes
export const CMD = {
  ARM: 0x01,
  DISARM: 0x02,
  FIRE: 0x10,
  TEST_CDS: 0x20,
  ESTOP: 0xFF,
} as const;

export const RSP = {
  ACK: 0xA0,
  STATUS: 0xA1,
  CDS: 0xA2,
} as const;

export interface ScannedBLEDevice {
  device: any; // BluetoothDevice
  name: string;
  id: string;
  rssi: number;
  connected: boolean;
}

export interface BLEModuleStatus {
  armed: boolean;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  cdsStatus: boolean[]; // continuity per channel
  rssi: number;
}

type AckCallback = (channel: number, latencyMs: number) => void;
type StatusCallback = (status: BLEModuleStatus) => void;
type DisconnectCallback = () => void;
type LogCallback = (message: string) => void;

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

class BLEFieldTransport {
  private device: any = null;
  private server: any = null;
  private cmdChar: any = null;
  private rspChar: any = null;
  private cdsChar: any = null;

  private onAck: AckCallback | null = null;
  private onStatus: StatusCallback | null = null;
  private onDisconnect: DisconnectCallback | null = null;
  private onLog: LogCallback | null = null;

  private _connected = false;
  private _moduleStatus: BLEModuleStatus = {
    armed: false,
    batteryLevel: null,
    firmwareVersion: null,
    cdsStatus: Array(32).fill(false),
    rssi: -100,
  };

  get connected() { return this._connected; }
  get moduleStatus() { return { ...this._moduleStatus }; }

  setCallbacks(cbs: {
    onAck?: AckCallback;
    onStatus?: StatusCallback;
    onDisconnect?: DisconnectCallback;
    onLog?: LogCallback;
  }) {
    if (cbs.onAck) this.onAck = cbs.onAck;
    if (cbs.onStatus) this.onStatus = cbs.onStatus;
    if (cbs.onDisconnect) this.onDisconnect = cbs.onDisconnect;
    if (cbs.onLog) this.onLog = cbs.onLog;
  }

  private log(msg: string) {
    this.onLog?.(msg);
  }

  /**
   * Scan for FXK modules using Web Bluetooth device picker
   */
  async scan(): Promise<ScannedBLEDevice | null> {
    if (!isWebBluetoothAvailable()) {
      throw new Error('Web Bluetooth não disponível. Use Chrome/Edge.');
    }

    try {
      this.log('🔍 Scanning BLE devices...');
      const nav = navigator as any;
      const device: BluetoothDevice = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'FXK' },
          { services: [FT_SERVICE_UUID] },
        ],
        optionalServices: [FT_SERVICE_UUID, '0000180f-0000-1000-8000-00805f9b34fb'], // battery
      });

      if (!device) return null;

      this.log(`📡 Found: ${device.name || device.id}`);
      return {
        device,
        name: device.name || 'FXK Module',
        id: device.id,
        rssi: -60, // Web Bluetooth doesn't expose RSSI directly
        connected: false,
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        this.log('❌ No device selected');
        return null;
      }
      throw err;
    }
  }

  /**
   * Connect to a scanned device and setup GATT characteristics
   */
  async connect(scanned: ScannedBLEDevice): Promise<boolean> {
    try {
      this.log(`🔗 Connecting to ${scanned.name}...`);
      this.device = scanned.device;

      // Listen for disconnects
      this.device.addEventListener('gattserverdisconnected', () => {
        this._connected = false;
        this.log('⚠️ BLE Disconnected');
        this.onDisconnect?.();
      });

      if (!this.device.gatt) {
        this.log('❌ GATT not available');
        return false;
      }

      this.server = await this.device.gatt.connect();
      this.log('✓ GATT connected');

      // Get FXK service
      const service = await this.server.getPrimaryService(FT_SERVICE_UUID);
      this.log('✓ FXK service found');

      // Get characteristics
      this.cmdChar = await service.getCharacteristic(FT_CMD_CHAR_UUID);
      this.log('✓ CMD characteristic ready');

      try {
        this.rspChar = await service.getCharacteristic(FT_RSP_CHAR_UUID);
        await this.rspChar.startNotifications();
        this.rspChar.addEventListener('characteristicvaluechanged', this.handleRspNotification);
        this.log('✓ RSP notifications active');
      } catch {
        this.log('⚠ RSP characteristic not available');
      }

      try {
        this.cdsChar = await service.getCharacteristic(FT_CDS_CHAR_UUID);
        await this.cdsChar.startNotifications();
        this.cdsChar.addEventListener('characteristicvaluechanged', this.handleCdsNotification);
        this.log('✓ CDS notifications active');
      } catch {
        this.log('⚠ CDS characteristic not available');
      }

      // Try battery service
      try {
        const battService = await this.server.getPrimaryService('0000180f-0000-1000-8000-00805f9b34fb');
        const battChar = await battService.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        const battValue = await battChar.readValue();
        this._moduleStatus.batteryLevel = battValue.getUint8(0);
        this.log(`🔋 Battery: ${this._moduleStatus.batteryLevel}%`);
      } catch {
        // optional
      }

      this._connected = true;
      scanned.connected = true;
      this.log(`✅ Connected to ${scanned.name}`);
      this.onStatus?.(this.moduleStatus);
      return true;
    } catch (err: any) {
      this.log(`❌ Connection failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Handle response notifications (ACK, STATUS)
   */
  private handleRspNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value || value.byteLength < 1) return;

    const opcode = value.getUint8(0);

    if (opcode === RSP.ACK && value.byteLength >= 4) {
      const channel = value.getUint8(1);
      const latency = value.getUint16(2, true); // little-endian
      this.log(`✅ BLE ACK CH-${String(channel).padStart(2, '0')} · ${latency}ms`);
      this.onAck?.(channel, latency);
    }

    if (opcode === RSP.STATUS && value.byteLength >= 5) {
      this._moduleStatus.armed = value.getUint8(1) === 1;
      this._moduleStatus.batteryLevel = value.getUint8(2);
      this._moduleStatus.firmwareVersion = `${value.getUint8(3)}.${value.getUint8(4)}`;
      this.onStatus?.(this.moduleStatus);
    }
  };

  /**
   * Handle CDS (continuity) notifications
   */
  private handleCdsNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const cds: boolean[] = [];
    for (let i = 0; i < 32; i++) {
      const byteIdx = Math.floor(i / 8);
      if (byteIdx < value.byteLength) {
        cds.push((value.getUint8(byteIdx) & (1 << (i % 8))) !== 0);
      } else {
        cds.push(false);
      }
    }
    this._moduleStatus.cdsStatus = cds;
    this.onStatus?.(this.moduleStatus);
  };

  // ─── Commands ──────────────────────────────────

  async writeCmd(opcode: number, payload: number[] = []): Promise<void> {
    if (!this.cmdChar || !this._connected) {
      throw new Error('BLE not connected');
    }
    const data = new Uint8Array([opcode, ...payload]);
    await this.cmdChar.writeValueWithResponse(data);
  }

  async arm(): Promise<void> {
    await this.writeCmd(CMD.ARM);
    this.log('🔑 BLE ARM sent');
  }

  async disarm(): Promise<void> {
    await this.writeCmd(CMD.DISARM);
    this.log('🔒 BLE DISARM sent');
  }

  async fire(channel: number): Promise<void> {
    const timestamp = Date.now() & 0xFFFFFFFF; // 4-byte timestamp
    await this.writeCmd(CMD.FIRE, [
      channel & 0xFF,
      (timestamp >> 24) & 0xFF,
      (timestamp >> 16) & 0xFF,
      (timestamp >> 8) & 0xFF,
      timestamp & 0xFF,
    ]);
    this.log(`🔥 BLE FIRE CH-${String(channel).padStart(2, '0')}`);
  }

  async eStop(): Promise<void> {
    await this.writeCmd(CMD.ESTOP);
    this.log('🚨 BLE E-STOP sent');
  }

  async testCDS(): Promise<void> {
    await this.writeCmd(CMD.TEST_CDS);
    this.log('🔍 BLE CDS test requested');
  }

  // ─── Disconnect ────────────────────────────────

  async disconnect(): Promise<void> {
    try {
      if (this.rspChar) {
        this.rspChar.removeEventListener('characteristicvaluechanged', this.handleRspNotification);
        await this.rspChar.stopNotifications().catch(() => {});
      }
      if (this.cdsChar) {
        this.cdsChar.removeEventListener('characteristicvaluechanged', this.handleCdsNotification);
        await this.cdsChar.stopNotifications().catch(() => {});
      }
      this.server?.disconnect();
    } catch { /* ignore */ }
    this._connected = false;
    this.device = null;
    this.server = null;
    this.cmdChar = null;
    this.rspChar = null;
    this.cdsChar = null;
    this.log('🔌 BLE disconnected');
  }
}

export const bleFieldTransport = new BLEFieldTransport();
