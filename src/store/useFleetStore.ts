/**
 * ─── Fleet Management Store ────────────────────────────────────────
 * Zustand store for Skybrush Live-style fleet management.
 * Manages UAV status, preflight checks, geofence, show control state.
 */

import { create } from 'zustand';
import type { UAVStatus, GeofenceConfig, ClockSyncState, ConnectionState } from '@/lib/flockwaveProtocol';
import type { PreflightCheckResult, PreflightSummary, PreflightConfig } from '@/lib/preflightChecks';
import { DEFAULT_PREFLIGHT_CONFIG } from '@/lib/preflightChecks';

export type ShowState = 'idle' | 'uploaded' | 'authorized' | 'countdown' | 'running' | 'paused' | 'completed' | 'aborted';

export interface FleetState {
  // Connection
  connectionState: ConnectionState;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  setConnectionState: (state: ConnectionState) => void;

  // UAVs
  uavs: Map<string, UAVStatus>;
  selectedUAVIds: string[];
  updateUAV: (id: string, status: UAVStatus) => void;
  updateMultipleUAVs: (statuses: UAVStatus[]) => void;
  selectUAV: (id: string | null) => void;
  toggleUAVSelection: (id: string) => void;
  selectAllUAVs: () => void;
  clearUAVSelection: () => void;
  removeUAV: (id: string) => void;
  clearAllUAVs: () => void;

  // Geofence
  geofence: GeofenceConfig;
  setGeofence: (config: Partial<GeofenceConfig>) => void;
  addGeofencePoint: (point: { lat: number; lon: number }) => void;
  removeGeofencePoint: (index: number) => void;
  clearGeofence: () => void;

  // Preflight
  preflightConfig: PreflightConfig;
  preflightResults: Map<string, PreflightCheckResult[]>;
  preflightSummary: PreflightSummary | null;
  setPreflightConfig: (config: Partial<PreflightConfig>) => void;
  setPreflightResults: (results: Map<string, PreflightCheckResult[]>, summary: PreflightSummary) => void;
  clearPreflightResults: () => void;

  // Show Control
  showState: ShowState;
  showProgress: number; // 0-1
  countdownSeconds: number;
  setShowState: (state: ShowState) => void;
  setShowProgress: (progress: number) => void;
  setCountdownSeconds: (seconds: number) => void;

  // Clock Sync
  clockSync: ClockSyncState;
  setClockSync: (sync: ClockSyncState) => void;

  // Storyboard
  storyboardEntries: StoryboardEntry[];
  addStoryboardEntry: (entry: StoryboardEntry) => void;
  updateStoryboardEntry: (id: string, updates: Partial<StoryboardEntry>) => void;
  removeStoryboardEntry: (id: string) => void;
  reorderStoryboard: (fromIndex: number, toIndex: number) => void;
  recalculateStoryboardTimings: () => void;
}

export interface StoryboardEntry {
  id: string;
  formationId: string;
  formationName: string;
  startFrame: number;
  duration: number; // frames
  transitionType: 'linear' | 'bezier' | 'optimal';
  transitionDuration: number; // frames
  locked: boolean;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  // Connection
  connectionState: 'disconnected',
  serverUrl: 'ws://localhost:5000/api/v1/ws',
  setServerUrl: (url) => set({ serverUrl: url }),
  setConnectionState: (state) => set({ connectionState: state }),

  // UAVs
  uavs: new Map(),
  selectedUAVIds: [],
  updateUAV: (id, status) => set(state => {
    const next = new Map(state.uavs);
    next.set(id, status);
    return { uavs: next };
  }),
  updateMultipleUAVs: (statuses) => set(state => {
    const next = new Map(state.uavs);
    for (const s of statuses) next.set(s.id, s);
    return { uavs: next };
  }),
  selectUAV: (id) => set({ selectedUAVIds: id ? [id] : [] }),
  toggleUAVSelection: (id) => set(state => ({
    selectedUAVIds: state.selectedUAVIds.includes(id)
      ? state.selectedUAVIds.filter(i => i !== id)
      : [...state.selectedUAVIds, id],
  })),
  selectAllUAVs: () => set(state => ({
    selectedUAVIds: Array.from(state.uavs.keys()),
  })),
  clearUAVSelection: () => set({ selectedUAVIds: [] }),
  removeUAV: (id) => set(state => {
    const next = new Map(state.uavs);
    next.delete(id);
    return { uavs: next, selectedUAVIds: state.selectedUAVIds.filter(i => i !== id) };
  }),
  clearAllUAVs: () => set({ uavs: new Map(), selectedUAVIds: [] }),

  // Geofence
  geofence: {
    enabled: false,
    maxAltitude: 120,
    maxDistance: 500,
    polygon: [],
    action: 'rth',
  },
  setGeofence: (config) => set(state => ({
    geofence: { ...state.geofence, ...config },
  })),
  addGeofencePoint: (point) => set(state => ({
    geofence: { ...state.geofence, polygon: [...state.geofence.polygon, point] },
  })),
  removeGeofencePoint: (index) => set(state => ({
    geofence: {
      ...state.geofence,
      polygon: state.geofence.polygon.filter((_, i) => i !== index),
    },
  })),
  clearGeofence: () => set(state => ({
    geofence: { ...state.geofence, polygon: [], enabled: false },
  })),

  // Preflight
  preflightConfig: DEFAULT_PREFLIGHT_CONFIG,
  preflightResults: new Map(),
  preflightSummary: null,
  setPreflightConfig: (config) => set(state => ({
    preflightConfig: { ...state.preflightConfig, ...config },
  })),
  setPreflightResults: (results, summary) => set({ preflightResults: results, preflightSummary: summary }),
  clearPreflightResults: () => set({ preflightResults: new Map(), preflightSummary: null }),

  // Show Control
  showState: 'idle',
  showProgress: 0,
  countdownSeconds: 0,
  setShowState: (state) => set({ showState: state }),
  setShowProgress: (progress) => set({ showProgress: progress }),
  setCountdownSeconds: (seconds) => set({ countdownSeconds: seconds }),

  // Clock Sync
  clockSync: { offset: 0, roundTrip: 0, synced: false, lastSync: 0, serverTime: 0 },
  setClockSync: (sync) => set({ clockSync: sync }),

  // Storyboard
  storyboardEntries: [],
  addStoryboardEntry: (entry) => set(state => ({
    storyboardEntries: [...state.storyboardEntries, entry],
  })),
  updateStoryboardEntry: (id, updates) => set(state => ({
    storyboardEntries: state.storyboardEntries.map(e =>
      e.id === id ? { ...e, ...updates } : e
    ),
  })),
  removeStoryboardEntry: (id) => set(state => ({
    storyboardEntries: state.storyboardEntries.filter(e => e.id !== id),
  })),
  reorderStoryboard: (fromIndex, toIndex) => set(state => {
    const entries = [...state.storyboardEntries];
    const [moved] = entries.splice(fromIndex, 1);
    entries.splice(toIndex, 0, moved);
    return { storyboardEntries: entries };
  }),
  recalculateStoryboardTimings: () => set(state => {
    let currentFrame = 0;
    const entries = state.storyboardEntries.map(entry => {
      const updated = { ...entry, startFrame: currentFrame };
      currentFrame += entry.duration + entry.transitionDuration;
      return updated;
    });
    return { storyboardEntries: entries };
  }),
}));
