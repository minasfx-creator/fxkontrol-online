/**
 * Wired DMX Engine — USB-C / Lightning DMX output for mobile devices
 * ENTTEC Open DMX, ENTTEC DMX USB Pro, Eurolite Pro MK2, DMXking ultraDMX Micro.
 * Uses WebSerial on desktop/Android, Capacitor serial plugin on iOS native.
 */
import {
  isWebSerialSupported,
  requestSerialPort,
  type USBDeviceProfile,
} from '@/lib/usbEngine';

export interface DMXOutputAdapter {
  id: string;
  name: string;
  type: 'enttec-open' | 'enttec-pro' | 'eurolite-mk2' | 'dmxking-micro' | 'generic';
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: ParityType;
  useWidgetProtocol: boolean;
  description: string;
}

export const DMX_ADAPTERS: DMXOutputAdapter[] = [
  {
    id: 'enttec-open',
    name: 'ENTTEC Open DMX USB',
    type: 'enttec-open',
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
    useWidgetProtocol: false,
    description: 'Direct DMX output via FTDI — 250kbaud, no framing',
  },
  {
    id: 'enttec-pro',
    name: 'ENTTEC DMX USB Pro',
    type: 'enttec-pro',
    baudRate: 57600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    useWidgetProtocol: true,
    description: 'Widget protocol with packet framing — supports RDM',
  },
  {
    id: 'eurolite-mk2',
    name: 'Eurolite USB-DMX512 Pro MK2',
    type: 'eurolite-mk2',
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
    useWidgetProtocol: false,
    description: 'Eurolite dual-universe DMX USB interface',
  },
  {
    id: 'dmxking-micro',
    name: 'DMXking ultraDMX Micro',
    type: 'dmxking-micro',
    baudRate: 57600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    useWidgetProtocol: true,
    description: 'Compact USB-C DMX — ENTTEC Pro compatible protocol',
  },
  {
    id: 'generic',
    name: 'Generic USB-DMX',
    type: 'generic',
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
    useWidgetProtocol: false,
    description: 'Generic FTDI-based DMX adapter',
  },
];

export interface DMXOutputStream {
  port: any;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  adapter: DMXOutputAdapter;
  universe: number;
  fps: number;
  streaming: boolean;
  framesSent: number;
  intervalId: ReturnType<typeof setInterval> | null;
}

let activeStream: DMXOutputStream | null = null;

export async function openDMXOutput(
  adapter: DMXOutputAdapter
): Promise<DMXOutputStream> {
  if (!isWebSerialSupported()) {
    throw new Error('WebSerial não disponível. Use Chrome/Edge ou o app nativo.');
  }

  const profile: USBDeviceProfile = {
    type: 'dmx',
    label: adapter.name,
    baudRate: adapter.baudRate,
    dataBits: adapter.dataBits,
    stopBits: adapter.stopBits,
    parity: adapter.parity,
    description: adapter.description,
  };

  const port = await requestSerialPort(profile);
  await port.open({
    baudRate: adapter.baudRate,
    dataBits: adapter.dataBits,
    stopBits: adapter.stopBits,
    parity: adapter.parity,
    bufferSize: 4096,
  });

  const writer = port.writable.getWriter();

  const stream: DMXOutputStream = {
    port,
    writer,
    adapter,
    universe: 1,
    fps: 44,
    streaming: false,
    framesSent: 0,
    intervalId: null,
  };

  activeStream = stream;
  return stream;
}

export function buildDMXFrame(channels: Uint8Array): Uint8Array {
  const frame = new Uint8Array(513);
  frame[0] = 0x00; // Start code
  frame.set(channels.subarray(0, 512), 1);
  return frame;
}

export function buildENTTECProFrame(channels: Uint8Array): Uint8Array {
  const dmxData = new Uint8Array(513);
  dmxData[0] = 0x00;
  dmxData.set(channels.subarray(0, 512), 1);

  const packet = new Uint8Array(dmxData.length + 5);
  packet[0] = 0x7E; // Start
  packet[1] = 6;    // Label: Output DMX
  packet[2] = dmxData.length & 0xFF;
  packet[3] = (dmxData.length >> 8) & 0xFF;
  packet.set(dmxData, 4);
  packet[packet.length - 1] = 0xE7; // End
  return packet;
}

export async function sendDMXFrame(
  stream: DMXOutputStream,
  channels: Uint8Array
): Promise<void> {
  if (!stream.writer) throw new Error('DMX output not open');

  const frame = stream.adapter.useWidgetProtocol
    ? buildENTTECProFrame(channels)
    : buildDMXFrame(channels);

  await stream.writer.write(frame);
  stream.framesSent++;
}

export function startDMXStream(
  stream: DMXOutputStream,
  getChannels: () => Uint8Array,
  fps = 44
): void {
  if (stream.streaming) return;

  stream.fps = Math.max(1, Math.min(44, fps));
  stream.streaming = true;

  const intervalMs = Math.round(1000 / stream.fps);
  stream.intervalId = setInterval(async () => {
    try {
      await sendDMXFrame(stream, getChannels());
    } catch {
      stopDMXStream(stream);
    }
  }, intervalMs);
}

export function stopDMXStream(stream: DMXOutputStream): void {
  if (stream.intervalId) {
    clearInterval(stream.intervalId);
    stream.intervalId = null;
  }
  stream.streaming = false;
}

export async function closeDMXOutput(stream: DMXOutputStream): Promise<void> {
  stopDMXStream(stream);
  try {
    await stream.writer.close().catch(() => {});
    stream.writer.releaseLock();
    await stream.port.close().catch(() => {});
  } catch { /* ignore */ }
  if (activeStream === stream) activeStream = null;
}

export function getActiveStream(): DMXOutputStream | null {
  return activeStream;
}

export function detectAdapter(deviceName: string): DMXOutputAdapter {
  const lower = (deviceName || '').toLowerCase();
  if (lower.includes('pro') && lower.includes('enttec')) return DMX_ADAPTERS[1];
  if (lower.includes('enttec') || lower.includes('open dmx')) return DMX_ADAPTERS[0];
  if (lower.includes('eurolite')) return DMX_ADAPTERS[2];
  if (lower.includes('dmxking') || lower.includes('ultradmx')) return DMX_ADAPTERS[3];
  return DMX_ADAPTERS[4];
}
