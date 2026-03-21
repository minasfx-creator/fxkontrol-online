/**
 * Bluetooth BLE Engine — Web Bluetooth for wireless DMX and firing control
 * Supports CRMX BLE, ShowBaby, Astera ART7, generic BLE-DMX adapters.
 * For iOS native: requires @capacitor-community/bluetooth-le plugin.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Web Bluetooth types (not in standard TS lib)
type BtDevice = any;
type BtGATTServer = any;
type BtCharacteristic = any;

export interface BLEDeviceProfile {
  name: string;
  serviceUUID: string;
  dmxCharUUID: string;
  statusCharUUID?: string;
  type: 'dmx' | 'firing' | 'telemetry' | 'generic';
  maxChannels: number;
  description: string;
}

export interface BLEConnectedDevice {
  id: string;
  name: string;
  profile: BLEDeviceProfile;
  device: BtDevice;
  server: BtGATTServer;
  dmxChar: BtCharacteristic;
  statusChar: BtCharacteristic;
  rssi: number;
  batteryLevel: number | null;
  connected: boolean;
  lastSeen: number;
}

export const BLE_PROFILES: BLEDeviceProfile[] = [
  {
    name: 'LumenRadio CRMX BLE',
    serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    dmxCharUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    statusCharUUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    type: 'dmx',
    maxChannels: 512,
    description: 'Wireless DMX via LumenRadio CRMX — ultra-low latency',
  },
  {
    name: 'City Theatrical ShowBaby',
    serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
    dmxCharUUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
    type: 'dmx',
    maxChannels: 512,
    description: 'ShowBaby wireless DMX transceiver',
  },
  {
    name: 'Astera ART7 / AsteraBox',
    serviceUUID: '0000fff0-0000-1000-8000-00805f9b34fb',
    dmxCharUUID: '0000fff1-0000-1000-8000-00805f9b34fb',
    statusCharUUID: '0000fff2-0000-1000-8000-00805f9b34fb',
    type: 'dmx',
    maxChannels: 512,
    description: 'Astera wireless LED fixture control',
  },
  {
    name: 'BLE Firing Module',
    serviceUUID: '12345678-1234-5678-1234-56789abcdef0',
    dmxCharUUID: '12345678-1234-5678-1234-56789abcdef1',
    statusCharUUID: '12345678-1234-5678-1234-56789abcdef2',
    type: 'firing',
    maxChannels: 40,
    description: 'BLE-connected pyro firing controller',
  },
  {
    name: 'Generic BLE-DMX',
    serviceUUID: '0000ffe5-0000-1000-8000-00805f9b34fb',
    dmxCharUUID: '0000ffe9-0000-1000-8000-00805f9b34fb',
    type: 'generic',
    maxChannels: 512,
    description: 'Generic BLE to DMX bridge adapter',
  },
];

const BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
const BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb';

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function scanBluetoothDevices(profileFilter?: BLEDeviceProfile): Promise<BtDevice> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth não suportado neste navegador. Use Chrome/Edge ou o app nativo iOS.');
  }

  const nav = navigator as any;
  const filters = profileFilter
    ? [{ services: [profileFilter.serviceUUID] }]
    : BLE_PROFILES.map(p => ({ services: [p.serviceUUID] }));

  const optionalServices = [BATTERY_SERVICE_UUID];

  return nav.bluetooth.requestDevice({
    filters,
    optionalServices,
  });
}

export async function connectBLEDevice(
  device: BtDevice,
  profile: BLEDeviceProfile
): Promise<BLEConnectedDevice> {
  if (!device.gatt) throw new Error('GATT not available');

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(profile.serviceUUID);
  const dmxChar = await service.getCharacteristic(profile.dmxCharUUID);

  let statusChar: BtCharacteristic = null;
  if (profile.statusCharUUID) {
    try {
      statusChar = await service.getCharacteristic(profile.statusCharUUID);
    } catch { /* optional */ }
  }

  let batteryLevel: number | null = null;
  try {
    const battService = await server.getPrimaryService(BATTERY_SERVICE_UUID);
    const battChar = await battService.getCharacteristic(BATTERY_LEVEL_UUID);
    const battValue = await battChar.readValue();
    batteryLevel = battValue.getUint8(0);
  } catch { /* battery service optional */ }

  return {
    id: device.id,
    name: device.name || 'BLE Device',
    profile,
    device,
    server,
    dmxChar,
    statusChar,
    rssi: -60,
    batteryLevel,
    connected: true,
    lastSeen: Date.now(),
  };
}

export async function sendBLEDMX(
  connDevice: BLEConnectedDevice,
  channels: number[]
): Promise<void> {
  if (!connDevice.dmxChar || !connDevice.connected) {
    throw new Error('Dispositivo BLE não conectado');
  }
  // BLE has 20-byte MTU by default, chunk the data
  const chunkSize = 20;
  const data = new Uint8Array(channels.slice(0, connDevice.profile.maxChannels));

  for (let offset = 0; offset < data.length; offset += chunkSize - 2) {
    const chunk = new Uint8Array(Math.min(chunkSize, data.length - offset + 2));
    // Header: offset high, offset low
    chunk[0] = (offset >> 8) & 0xFF;
    chunk[1] = offset & 0xFF;
    chunk.set(data.slice(offset, offset + chunkSize - 2), 2);
    await connDevice.dmxChar.writeValueWithoutResponse(chunk);
  }
}

export async function sendBLEFireCommand(
  connDevice: BLEConnectedDevice,
  module: number,
  cue: number
): Promise<void> {
  if (!connDevice.dmxChar || !connDevice.connected) {
    throw new Error('Dispositivo BLE não conectado');
  }
  const cmd = new Uint8Array([0xFE, module & 0xFF, cue & 0xFF, 0x01]); // 0xFE = fire opcode
  await connDevice.dmxChar.writeValueWithResponse(cmd);
}

export function onBLENotification(
  connDevice: BLEConnectedDevice,
  callback: (data: DataView) => void
): void {
  if (!connDevice.statusChar) return;
  connDevice.statusChar.startNotifications();
  connDevice.statusChar.addEventListener('characteristicvaluechanged', (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (target.value) callback(target.value);
  });
}

export async function disconnectBLE(connDevice: BLEConnectedDevice): Promise<void> {
  try {
    if (connDevice.statusChar) {
      await connDevice.statusChar.stopNotifications().catch(() => {});
    }
    connDevice.server?.disconnect();
  } catch { /* ignore */ }
  connDevice.connected = false;
}

export function matchProfile(deviceName: string): BLEDeviceProfile | undefined {
  const lower = (deviceName || '').toLowerCase();
  if (lower.includes('crmx') || lower.includes('lumenradio')) return BLE_PROFILES[0];
  if (lower.includes('showbaby')) return BLE_PROFILES[1];
  if (lower.includes('astera')) return BLE_PROFILES[2];
  return BLE_PROFILES[4]; // generic
}
