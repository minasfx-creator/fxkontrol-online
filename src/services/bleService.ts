/**
 * BLE connection service for FXK-M1 module
 * Uses Web Bluetooth API to connect after NFC tap
 */

const FXK_SERVICE_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
const FXK_CMD_CHAR_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';
const FXK_STATUS_CHAR_UUID = '0000ff03-0000-1000-8000-00805f9b34fb';
const FXK_CDS_CHAR_UUID = '0000ff04-0000-1000-8000-00805f9b34fb';

export interface FXKModuleState {
  connected: boolean;
  deviceName: string | null;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  channelCount: number;
  rssi: number | null;
  armed: boolean;
  cdsStatus: boolean[]; // continuity per channel
}

export const initialModuleState: FXKModuleState = {
  connected: false,
  deviceName: null,
  batteryLevel: null,
  firmwareVersion: null,
  channelCount: 32,
  rssi: null,
  armed: false,
  cdsStatus: Array(32).fill(false),
};

type StateListener = (state: FXKModuleState) => void;

class BLEService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null;
  private cdsChar: BluetoothRemoteGATTCharacteristic | null = null;
  private state: FXKModuleState = { ...initialModuleState };
  private listeners: Set<StateListener> = new Set();

  subscribe(fn: StateListener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn({ ...this.state }));
  }

  private setState(partial: Partial<FXKModuleState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  get isSupported() {
    return 'bluetooth' in navigator;
  }

  get isNFCSupported() {
    return 'NDEFReader' in window;
  }

  async connectViaNFC(): Promise<string | null> {
    if (!this.isNFCSupported) return null;
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      return new Promise((resolve) => {
        ndef.addEventListener('reading', ({ message }: any) => {
          for (const record of message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder();
              const data = decoder.decode(record.data);
              // NFC tag contains "FXK:<device_name>"
              if (data.startsWith('FXK:')) {
                resolve(data.substring(4));
                return;
              }
            }
          }
          resolve(null);
        });
      });
    } catch {
      return null;
    }
  }

  async connect(deviceNameFilter?: string): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      const filters: BluetoothLEScanFilter[] = deviceNameFilter
        ? [{ name: deviceNameFilter }]
        : [{ namePrefix: 'FXK-M1' }];

      this.device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: [FXK_SERVICE_UUID],
      });

      if (!this.device.gatt) return false;

      this.device.addEventListener('gattserverdisconnected', () => {
        this.setState({ connected: false, armed: false });
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(FXK_SERVICE_UUID);

      this.cmdChar = await service.getCharacteristic(FXK_CMD_CHAR_UUID);
      this.statusChar = await service.getCharacteristic(FXK_STATUS_CHAR_UUID);
      this.cdsChar = await service.getCharacteristic(FXK_CDS_CHAR_UUID);

      // Subscribe to status notifications
      await this.statusChar.startNotifications();
      this.statusChar.addEventListener('characteristicvaluechanged', (e: any) => {
        const value = e.target.value as DataView;
        this.setState({
          batteryLevel: value.getUint8(0),
          armed: value.getUint8(1) === 1,
          firmwareVersion: `${value.getUint8(2)}.${value.getUint8(3)}.${value.getUint8(4)}`,
        });
      });

      // Subscribe to CDS notifications
      await this.cdsChar.startNotifications();
      this.cdsChar.addEventListener('characteristicvaluechanged', (e: any) => {
        const value = e.target.value as DataView;
        const cds: boolean[] = [];
        for (let i = 0; i < 32; i++) {
          cds.push((value.getUint8(Math.floor(i / 8)) & (1 << (i % 8))) !== 0);
        }
        this.setState({ cdsStatus: cds });
      });

      this.setState({
        connected: true,
        deviceName: this.device.name || 'FXK-M1',
      });

      return true;
    } catch (err) {
      console.warn('[BLE] Connection failed:', err);
      return false;
    }
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.setState({ ...initialModuleState });
  }

  async sendCommand(cmd: number, payload: number[] = []) {
    if (!this.cmdChar) return;
    const data = new Uint8Array([cmd, ...payload]);
    await this.cmdChar.writeValue(data);
  }

  async arm() { await this.sendCommand(0x01); }
  async disarm() { await this.sendCommand(0x02); }
  async fire(channel: number) { await this.sendCommand(0x10, [channel]); }
  async testCDS() { await this.sendCommand(0x20); }
  async eStop() { await this.sendCommand(0xFF); }
}

export const bleService = new BLEService();
