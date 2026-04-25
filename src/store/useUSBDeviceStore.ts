/**
 * Shared USB Device Store
 * Bridge between USBConnectionPanel and DMXPanel for direct USB DMX output.
 *
 * Honest Hardware Layer: a device is only considered ready to transmit DMX
 * when (1) the browser has authorized the port (writer present), (2) the
 * adapter family was recognized from the authorized profile label OR the
 * operator explicitly confirmed a generic adapter, and (3) the connection
 * is in `connected` state.
 */
import { create } from 'zustand';
import type { ConnectedDevice } from '@/lib/usbEngine';
import {
  sendSerialData,
  buildENTTECProPacket,
  buildDMX512Frame,
} from '@/lib/usbEngine';
import { detectDMXAdapter, type DMXAdapterKind, type DMXAdapterInfo } from '@/lib/dmxAdapterRecognition';
import {
  portRegistry, keyFor,
  type GenericConfirmMode, type DMXProfileOverrideKind,
} from '@/core/discovery/portRegistry';
import { logger } from '@/lib/logger';

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
  /** Operator explicitly confirmed transmitting on a generic adapter. */
  operatorConfirmedGeneric: boolean;
  /** Mode chosen during generic confirmation (open vs pro wrapper). */
  confirmedMode?: GenericConfirmMode;
  /** Operator-pinned profile override kind (wins over label detection). */
  profileOverride?: DMXProfileOverrideKind;
  /** True iff connected + authorized + (recognized OR operator-confirmed OR override set). */
  outputReady: boolean;
  device: ConnectedDevice;
}

interface USBDeviceStore {
  dmxDevices: USBDMXDevice[];
  registerDevice: (device: ConnectedDevice) => void;
  unregisterDevice: (deviceId: string) => void;
  /** Operator explicitly authorizes DMX output on a generic adapter. */
  confirmGenericAdapter: (deviceId: string, mode: GenericConfirmMode) => void;
  /** Revoke a prior generic-adapter confirmation. */
  revokeGenericAdapter: (deviceId: string) => void;
  /** Pin a per-device DMX profile (Open DMX vs ENTTEC Pro vs vendor preset). */
  setProfileOverride: (deviceId: string, kind: DMXProfileOverrideKind) => void;
  /** Clear the profile override and fall back to label-based detection. */
  clearProfileOverride: (deviceId: string) => void;
  getConnectedDMXDevices: () => USBDMXDevice[];
  /** Only devices that are connected, authorized AND ready to TX (recognized or confirmed). */
  getAuthorizedDMXDevices: () => USBDMXDevice[];
  sendDMXFrame: (deviceId: string, channels: Uint8Array) => Promise<{ bytesSent: number; latencyMs: number }>;
  sendDMXToAll: (channels: Uint8Array) => Promise<{ deviceCount: number; totalBytes: number; latencyMs: number }>;
}

function registryKeyFor(device: ConnectedDevice): string | undefined {
  const info = device.port?.getInfo?.();
  if (!info) return undefined;
  return keyFor({ vendorId: info.usbVendorId, productId: info.usbProductId });
}

/** Synthetic adapter-info preset for an operator-pinned override kind. */
function adapterFromOverride(kind: DMXProfileOverrideKind): DMXAdapterInfo {
  switch (kind) {
    case 'enttec-pro':
      return {
        kind: 'enttec-pro', label: 'ENTTEC DMX USB Pro (override)',
        badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/40',
        protocol: 'ENTTEC Widget', rdmCapable: true,
        recognized: true, requiresOperatorConfirmation: false,
      };
    case 'enttec-open':
      return {
        kind: 'enttec-open', label: 'ENTTEC Open DMX (override)',
        badgeClass: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
        protocol: 'DMX512 Direto', rdmCapable: false,
        recognized: true, requiresOperatorConfirmation: false,
      };
    case 'dmxking':
      return {
        kind: 'dmxking', label: 'DMXking ultraDMX (override)',
        badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/40',
        protocol: 'ENTTEC Widget', rdmCapable: true,
        recognized: true, requiresOperatorConfirmation: false,
      };
    case 'eurolite':
      return {
        kind: 'eurolite', label: 'Eurolite USB-DMX512 (override)',
        badgeClass: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
        protocol: 'DMX512 Direto', rdmCapable: false,
        recognized: true, requiresOperatorConfirmation: false,
      };
    case 'generic-dmx':
    default:
      return {
        kind: 'generic-dmx', label: 'DMX Genérico (override)',
        badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
        protocol: 'DMX512 Direto', rdmCapable: false,
        recognized: false, requiresOperatorConfirmation: true,
      };
  }
}

function buildEntry(device: ConnectedDevice): USBDMXDevice {
  const detected = detectDMXAdapter(device.profile);
  const authorized = !!device.writer;
  const stateConnected = device.state === 'connected';
  const regKey = registryKeyFor(device);
  const persisted = regKey ? portRegistry.get(regKey) : undefined;
  const operatorConfirmedGeneric = persisted?.operatorConfirmedGeneric === true;
  const confirmedMode = persisted?.confirmedMode;
  const overrideKind = persisted?.profileOverride?.kind;

  // Operator override wins over label-based detection.
  const adapter = overrideKind ? adapterFromOverride(overrideKind) : detected;

  // ENTTEC Pro packet wrapping: detected pro, override pro, OR confirmed-as-pro mode.
  const isENTTECPro = adapter.kind === 'enttec-pro' || confirmedMode === 'pro';

  // An explicit override counts as operator authorization for output-ready.
  const overrideAuthorizes = !!overrideKind;

  return {
    id: device.id,
    label: device.profile.label,
    type: device.profile.type,
    state: stateConnected ? 'connected' : 'disconnected',
    isENTTECPro,
    adapterKind: adapter.kind,
    adapterLabel: adapter.label,
    protocol: adapter.protocol,
    recognized: adapter.recognized,
    authorized,
    operatorConfirmedGeneric,
    confirmedMode,
    profileOverride: overrideKind,
    outputReady:
      device.profile.type === 'dmx' &&
      authorized &&
      stateConnected &&
      (adapter.recognized || operatorConfirmedGeneric || overrideAuthorizes),
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

  confirmGenericAdapter: (deviceId: string, mode: GenericConfirmMode) => {
    const entry = get().dmxDevices.find(d => d.id === deviceId);
    if (!entry) return;
    const regKey = registryKeyFor(entry.device);
    const info = entry.device.port?.getInfo?.();
    if (regKey) {
      portRegistry.confirmGeneric(regKey, mode, entry.label, {
        vendorId: info?.usbVendorId,
        productId: info?.usbProductId,
      });
    }
    logger.warn('[USBDeviceStore] generic adapter operator-confirmed', {
      deviceId, mode, label: entry.label, regKey,
    });
    set(state => ({
      dmxDevices: state.dmxDevices.map(d => d.id === deviceId
        ? {
            ...d,
            operatorConfirmedGeneric: true,
            confirmedMode: mode,
            isENTTECPro: d.adapterKind === 'enttec-pro' || mode === 'pro',
            outputReady: d.type === 'dmx' && d.authorized && d.state === 'connected',
          }
        : d),
    }));
  },

  revokeGenericAdapter: (deviceId: string) => {
    const entry = get().dmxDevices.find(d => d.id === deviceId);
    if (!entry) return;
    const regKey = registryKeyFor(entry.device);
    if (regKey) portRegistry.forget(regKey);
    set(state => ({
      dmxDevices: state.dmxDevices.map(d => d.id === deviceId
        ? {
            ...d,
            operatorConfirmedGeneric: false,
            confirmedMode: undefined,
            outputReady: d.type === 'dmx' && d.authorized && d.state === 'connected' && d.recognized,
          }
        : d),
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
            : !entry.recognized && !entry.operatorConfirmedGeneric
              ? 'adapter genérico aguardando confirmação do operador'
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
    const frame = buildDMX512Frame(channels);
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
