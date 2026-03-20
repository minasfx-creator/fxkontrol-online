/**
 * USB Connection Engine
 * Supports WebUSB + Web Serial APIs for connecting to show equipment.
 * Uses `any` casts for Web Serial/USB APIs since they're not in standard TS lib.
 */

export type USBDeviceType = 'dmx' | 'firing' | 'timecode' | 'serial' | 'pbus' | 'radio';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface USBDeviceProfile {
  type: USBDeviceType;
  label: string;
  vendorId?: number;
  productId?: number;
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: string;
  description: string;
}

export interface ConnectedDevice {
  id: string;
  profile: USBDeviceProfile;
  state: ConnectionState;
  port?: any; // SerialPort
  usbDevice?: any; // USBDevice
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  lastData?: Uint8Array;
  lastDataTime?: number;
  bytesReceived: number;
  bytesSent: number;
  error?: string;
}

export interface USBLog {
  timestamp: Date;
  deviceId: string;
  direction: 'tx' | 'rx' | 'info' | 'error';
  message: string;
  data?: Uint8Array;
}

// Known device profiles
export const DEVICE_PROFILES: USBDeviceProfile[] = [
  {
    type: 'dmx',
    label: 'ENTTEC Open DMX USB',
    vendorId: 0x0403,
    productId: 0x6001,
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
    description: 'DMX512 output via FTDI chip',
  },
  {
    type: 'dmx',
    label: 'ENTTEC DMX USB Pro',
    vendorId: 0x0403,
    productId: 0x6001,
    baudRate: 57600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    description: 'DMX512 I/O with RDM support',
  },
  {
    type: 'firing',
    label: 'Firing Controller (Serial)',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    description: 'Generic pyro firing controller via RS-232/RS-485',
  },
  {
    type: 'timecode',
    label: 'Timecode Reader (SMPTE/LTC)',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    description: 'External timecode reader/generator',
  },
  {
    type: 'serial',
    label: 'Serial Genérico',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    description: 'RS-232 / RS-485 / Arduino / Custom device',
  },
  {
    type: 'pbus',
    label: 'Showven PBUS (PyroSlave)',
    baudRate: 19200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    description: 'PBUS protocol for PyroSlave C16/X4/PyroMote (433M/868M dual-band)',
  },
];

const nav = navigator as any;

export function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}

export function isWebUSBSupported(): boolean {
  return 'usb' in navigator;
}

export async function requestSerialPort(profile?: USBDeviceProfile): Promise<any> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API não suportada neste navegador');
  }
  const filters: any[] = [];
  if (profile?.vendorId) {
    filters.push({
      usbVendorId: profile.vendorId,
      ...(profile.productId ? { usbProductId: profile.productId } : {}),
    });
  }
  return nav.serial.requestPort(filters.length > 0 ? { filters } : undefined);
}

export async function requestUSBDevice(profile?: USBDeviceProfile): Promise<any> {
  if (!isWebUSBSupported()) {
    throw new Error('WebUSB API não suportada neste navegador');
  }
  const filters: any[] = [];
  if (profile?.vendorId) {
    filters.push({
      vendorId: profile.vendorId,
      ...(profile.productId ? { productId: profile.productId } : {}),
    });
  }
  return nav.usb.requestDevice({
    filters: filters.length > 0 ? filters : [{ vendorId: 0x0403 }],
  });
}

export async function openSerialConnection(
  port: any,
  profile: USBDeviceProfile
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; writer: WritableStreamDefaultWriter<Uint8Array> }> {
  await port.open({
    baudRate: profile.baudRate,
    dataBits: profile.dataBits ?? 8,
    stopBits: profile.stopBits ?? 1,
    parity: profile.parity ?? 'none',
    bufferSize: 4096,
  });
  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();
  return { reader, writer };
}

export async function closeSerialConnection(device: ConnectedDevice): Promise<void> {
  try {
    if (device.reader) {
      await device.reader.cancel().catch(() => {});
      device.reader.releaseLock();
    }
    if (device.writer) {
      await device.writer.close().catch(() => {});
      device.writer.releaseLock();
    }
    if (device.port) {
      await device.port.close().catch(() => {});
    }
  } catch {
    // Ignore close errors
  }
}

export async function sendSerialData(device: ConnectedDevice, data: Uint8Array): Promise<void> {
  if (!device.writer || device.state !== 'connected') {
    throw new Error('Dispositivo não conectado');
  }
  await device.writer.write(data);
  device.bytesSent += data.length;
}

export function buildENTTECProPacket(label: number, data: Uint8Array): Uint8Array {
  const packet = new Uint8Array(data.length + 5);
  packet[0] = 0x7e;
  packet[1] = label;
  packet[2] = data.length & 0xff;
  packet[3] = (data.length >> 8) & 0xff;
  packet.set(data, 4);
  packet[packet.length - 1] = 0xe7;
  return packet;
}

export function buildDMX512Frame(channels: Uint8Array): Uint8Array {
  const frame = new Uint8Array(513);
  frame[0] = 0x00;
  frame.set(channels.subarray(0, 512), 1);
  return frame;
}

export function bytesToHex(data: Uint8Array, maxBytes = 32): string {
  const slice = data.slice(0, maxBytes);
  const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
  return data.length > maxBytes ? `${hex} ... (+${data.length - maxBytes})` : hex;
}

export function generateDeviceId(): string {
  return `usb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
