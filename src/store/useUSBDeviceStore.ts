/**
 * Shared USB Device Store
 * Bridge between USBConnectionPanel and DMXPanel for direct USB DMX output.
 *
 * Honest Hardware Layer: a device is only considered ready to transmit DMX
 * when (1) the browser has authorized the port (writer present), (2) the
 * adapter family was recognized from the authorized profile label, and
 * (3) the connection is in `connected` state.
 */
import { create } from 'zustand';
import type { ConnectedDevice } from '@/lib/usbEngine';
import {
  sendSerialData,
  buildENTTECProPacket,
  buildDMX512Frame,
} from '@/lib/usbEngine';
import { detectDMXAdapter, type DMXAdapterKind } from '@/lib/dmxAdapterRecognition';

export interface USBDMXDevice {
  id: string;
  label: string;
  type: 'dmx' | 'firing' | 'timecode' | 'serial' | 'pbus' | 'radio';
  state: 'connected' | 'disconnected';
  isENTTECPro: boolean;
  /** Adapter family detected from the authorized profile label. */
  adapterKind: DMXAdapterKind;
  adapterLabel: string;
  protocol: 'ENTTEC Widget' | 'DMX512 Direto' | '—';
  /** True if the adapter family is in the recognized list (not generic). */
  recognized: boolean;
  /** True if browser exposed a writer (port was authorized successfully). */
  authorized: boolean;
  /** True iff connected + authorized + recognized — gates DMX transmission. */
  outputReady: boolean;
  device: ConnectedDevice;
}

interface USBDeviceStore {
  dmxDevices: USBDMXDevice[];
  registerDevice: (device: ConnectedDevice) => void;
  unregisterDevice: (deviceId: string) => void;
  getConnectedDMXDevices: () => USBDMXDevice[];
  /** Only devices that are connected, authorized AND recognized. */
  getAuthorizedDMXDevices: () => USBDMXDevice[];
  sendDMXFrame: (deviceId: string, channels: Uint8Array) => Promise<{ bytesSent: number; latencyMs: number }>;
  sendDMXToAll: (channels: Uint8Array) => Promise<{ deviceCount: number; totalBytes: number; latencyMs: number }>;
}

function buildEntry(device: ConnectedDevice): USBDMXDevice {
  const adapter = detectDMXAdapter(device.profile);
  const authorized = !!device.writer;
  const stateConnected = device.state === 'connected';
  return {
    id: device.id,
    label: device.profile.label,
    type: device.profile.type,
    state: stateConnected ? 'connected' : 'disconnected',
    isENTTECPro: adapter.kind === 'enttec-pro',
    adapterKind: adapter.kind,
    adapterLabel: adapter.label,
    protocol: adapter.protocol,
    recognized: adapter.recognized,
    authorized,
    outputReady:
      device.profile.type === 'dmx' &&
      adapter.recognized &&
      authorized &&
      stateConnected,
    device,
  };
}

export const useUSBDeviceStore = create<USBDeviceStore>((set, get) => ({
  dmxDevices: [],

  registerDevice: (device: ConnectedDevice) => {
    const entry = buildEntry(device);
    set(state => ({
      dmxDevices: [
        ...state.dmxDevices.filter(d => d.id !== device.id),
        entry,
      ],
    }));
  },

  unregisterDevice: (deviceId: string) => {
    set(state => ({
      dmxDevices: state.dmxDevices.filter(d => d.id !== deviceId),
    }));
  },

  getConnectedDMXDevices: () => {
    return get().dmxDevices.filter(d => d.state === 'connected' && d.type === 'dmx');
  },

  getAuthorizedDMXDevices: () => {
    return get().dmxDevices.filter(d => d.outputReady);
  },

  sendDMXFrame: async (deviceId: string, channels: Uint8Array) => {
    const entry = get().dmxDevices.find(d => d.id === deviceId);
    if (!entry) throw new Error('Dispositivo USB não encontrado');
    if (!entry.outputReady) {
      throw new Error(
        `Saída DMX bloqueada: ${
          !entry.authorized
            ? 'porta não autorizada pelo navegador'
            : !entry.recognized
              ? 'adapter não reconhecido'
              : 'dispositivo não conectado'
        }`,
      );
    }
    const t0 = performance.now();
    const frame = buildDMX512Frame(channels);
    const data = entry.isENTTECPro ? buildENTTECProPacket(6, frame) : frame;
    await sendSerialData(entry.device, data);
    return { bytesSent: data.length, latencyMs: Math.round(performance.now() - t0) };
  },

  sendDMXToAll: async (channels: Uint8Array) => {
    const dmxDevices = get().getAuthorizedDMXDevices();
    if (dmxDevices.length === 0) {
      throw new Error('Nenhum dispositivo DMX USB autorizado/reconhecido');
    }
    const t0 = performance.now();
    // Build frame ONCE (DMX payload is identical for all outputs);
    // each device may wrap it differently (ENTTEC Pro vs raw DMX512).
    const frame = buildDMX512Frame(channels);
    // Send to all writers in parallel — serial `await` in a for-loop
    // multiplied USB latency by the device count and broke 40Hz timing
    // when more than one output was authorized.
    const results = await Promise.all(
      dmxDevices.map(entry => {
        const data = entry.isENTTECPro ? buildENTTECProPacket(6, frame) : frame;
        return sendSerialData(entry.device, data).then(() => data.length);
      }),
    );
    const totalBytes = results.reduce((sum, n) => sum + n, 0);
    return {
      deviceCount: dmxDevices.length,
      totalBytes,
      latencyMs: Math.round(performance.now() - t0),
    };
  },
}));
