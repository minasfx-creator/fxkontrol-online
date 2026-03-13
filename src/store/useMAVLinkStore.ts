import { create } from 'zustand';
import {
  type DroneTelemetry,
  type TelemetryPacket,
  type MAVLinkRateConfig,
  type MAVLinkMessage,
  createDefaultTelemetry,
  generateFullPacket,
  updateTelemetryFromSim,
  DEFAULT_RATE_CONFIG,
  formatMessageLog,
} from '@/lib/mavlinkProtocol';

export interface MAVLinkLogEntry {
  timestamp: number;
  direction: 'tx' | 'rx';
  message: string;
  systemId: number;
}

interface MAVLinkState {
  connected: boolean;
  bridgeActive: boolean;
  drones: Map<number, DroneTelemetry>;
  packets: TelemetryPacket[];
  log: MAVLinkLogEntry[];
  rateConfig: MAVLinkRateConfig;
  selectedDroneId: number | null;
  packetCount: number;
  bytesTransferred: number;

  setConnected: (connected: boolean) => void;
  setBridgeActive: (active: boolean) => void;
  initDrone: (systemId: number) => void;
  updateDrone: (systemId: number, telemetry: DroneTelemetry) => void;
  addPacket: (packet: TelemetryPacket) => void;
  addLog: (entry: MAVLinkLogEntry) => void;
  setRateConfig: (config: Partial<MAVLinkRateConfig>) => void;
  setSelectedDroneId: (id: number | null) => void;
  clearLog: () => void;
  resetAll: () => void;
}

export const useMAVLinkStore = create<MAVLinkState>((set, get) => ({
  connected: false,
  bridgeActive: false,
  drones: new Map(),
  packets: [],
  log: [],
  rateConfig: { ...DEFAULT_RATE_CONFIG },
  selectedDroneId: null,
  packetCount: 0,
  bytesTransferred: 0,

  setConnected: (connected) => set({ connected }),
  setBridgeActive: (active) => set({ bridgeActive: active }),

  initDrone: (systemId) => set((s) => {
    const drones = new Map(s.drones);
    if (!drones.has(systemId)) {
      drones.set(systemId, createDefaultTelemetry(systemId));
    }
    return { drones };
  }),

  updateDrone: (systemId, telemetry) => set((s) => {
    const drones = new Map(s.drones);
    drones.set(systemId, telemetry);
    return { drones };
  }),

  addPacket: (packet) => set((s) => ({
    packets: [...s.packets.slice(-99), packet],
    packetCount: s.packetCount + 1,
    bytesTransferred: s.bytesTransferred + JSON.stringify(packet).length,
  })),

  addLog: (entry) => set((s) => ({
    log: [...s.log.slice(-199), entry],
  })),

  setRateConfig: (config) => set((s) => ({
    rateConfig: { ...s.rateConfig, ...config },
  })),

  setSelectedDroneId: (id) => set({ selectedDroneId: id }),
  clearLog: () => set({ log: [], packetCount: 0, bytesTransferred: 0 }),
  resetAll: () => set({
    connected: false,
    bridgeActive: false,
    drones: new Map(),
    packets: [],
    log: [],
    packetCount: 0,
    bytesTransferred: 0,
    selectedDroneId: null,
  }),
}));
