/**
 * Shared USB Device Store
 * Bridge between USBConnectionPanel and DMXPanel for direct USB DMX output.
 */
import { create } from 'zustand';
import type { ConnectedDevice } from '@/lib/usbEngine';
import {
  sendSerialData,
  buildENTTECProPacket,
  buildDMX512Frame,
} from '@/lib/usbEngine';

export interface USBDMXDevice {
  id: string;
  label: string;
  type: 'dmx' | 'firing' | 'timecode' | 'serial' | 'pbus';
  state: 'connected' | 'disconnected';
  isENTTECPro: boolean;
  device: ConnectedDevice;
}

interface USBDeviceStore {
  dmxDevices: USBDMXDevice[];
  registerDevice: (device: ConnectedDevice) => void;
  unregisterDevice: (deviceId: string) => void;
  getConnectedDMXDevices: () => USBDMXDevice[];
  sendDMXFrame: (deviceId: string, channels: Uint8Array) => Promise<{ bytesSent: number; latencyMs: number }>;
  sendDMXToAll: (channels: Uint8Array) => Promise<{ deviceCount: number; totalBytes: number; latencyMs: number }>;
}

export const useUSBDeviceStore = create<USBDeviceStore>((set, get) => ({
  dmxDevices: [],

  registerDevice: (device: ConnectedDevice) => {
    const entry: USBDMXDevice = {
      id: device.id,
      label: device.profile.label,
      type: device.profile.type,
      state: device.state === 'connected' ? 'connected' : 'disconnected',
      isENTTECPro: device.profile.label.includes('Pro'),
      device,
    };
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

  sendDMXFrame: async (deviceId: string, channels: Uint8Array) => {
    const entry = get().dmxDevices.find(d => d.id === deviceId);
    if (!entry || entry.state !== 'connected') {
      throw new Error('Dispositivo USB não conectado');
    }
    const t0 = performance.now();
    const frame = buildDMX512Frame(channels);
    const data = entry.isENTTECPro ? buildENTTECProPacket(6, frame) : frame;
    await sendSerialData(entry.device, data);
    return { bytesSent: data.length, latencyMs: Math.round(performance.now() - t0) };
  },

  sendDMXToAll: async (channels: Uint8Array) => {
    const dmxDevices = get().getConnectedDMXDevices();
    if (dmxDevices.length === 0) {
      throw new Error('Nenhum dispositivo DMX USB conectado');
    }
    const t0 = performance.now();
    let totalBytes = 0;
    for (const entry of dmxDevices) {
      const frame = buildDMX512Frame(channels);
      const data = entry.isENTTECPro ? buildENTTECProPacket(6, frame) : frame;
      await sendSerialData(entry.device, data);
      totalBytes += data.length;
    }
    return {
      deviceCount: dmxDevices.length,
      totalBytes,
      latencyMs: Math.round(performance.now() - t0),
    };
  },
}));
