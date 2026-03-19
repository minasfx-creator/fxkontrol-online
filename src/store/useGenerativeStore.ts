/**
 * useGenerativeStore — bridges Lightjams generative engine with 3D viewport.
 * Exposes computed RGB colors that InstancedDroneSwarm reads per-frame.
 */
import { create } from 'zustand';
import {
  GenerativeLayer,
  renderGenerativeFrame,
  rgbToHex,
  GENERATIVE_PRESETS,
  type AudioModulationData,
  type RGBColor,
} from '@/lib/generativeEngine';

interface GenerativeState {
  // ── State ──
  enabled: boolean;
  layers: GenerativeLayer[];
  playing: boolean;
  time: number;
  audio: AudioModulationData;

  // ── Computed output (updated each frame) ──
  outputColors: string[];   // hex colors per pixel/drone
  outputRGB: RGBColor[];    // raw RGB 0-1

  // ── Actions ──
  setEnabled: (v: boolean) => void;
  setLayers: (layers: GenerativeLayer[]) => void;
  setPlaying: (v: boolean) => void;
  setAudio: (audio: AudioModulationData) => void;
  loadPreset: (presetId: string) => void;

  /** Called every animation frame with delta time to advance the engine */
  tick: (dt: number, droneCount: number) => void;

  /** Sync time with the master timeline playhead */
  syncTime: (time: number) => void;
}

const useGenerativeStore = create<GenerativeState>((set, get) => ({
  enabled: false,
  layers: GENERATIVE_PRESETS[0].layers.map(l => ({ ...l })),
  playing: true,
  time: 0,
  audio: { bass: 0.5, mid: 0.5, high: 0.5 },
  outputColors: [],
  outputRGB: [],

  setEnabled: (v) => set({ enabled: v }),
  setLayers: (layers) => set({ layers }),
  setPlaying: (v) => set({ playing: v }),
  setAudio: (audio) => set({ audio }),

  loadPreset: (presetId) => {
    const preset = GENERATIVE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      set({
        layers: preset.layers.map(l => ({
          ...l,
          id: `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        })),
        time: 0,
      });
    }
  },

  syncTime: (time) => set({ time }),

  tick: (dt, droneCount) => {
    const state = get();
    if (!state.enabled || !state.playing || droneCount === 0) return;

    const newTime = state.time + dt;

    // Simulated audio when no real input
    const simAudio: AudioModulationData = {
      bass: (Math.sin(newTime * 1.2) + 1) / 2,
      mid: (Math.sin(newTime * 2.5 + 1) + 1) / 2,
      high: (Math.sin(newTime * 4.8 + 2) + 1) / 2,
    };

    const audio = state.audio.bass === 0.5 && state.audio.mid === 0.5 && state.audio.high === 0.5
      ? simAudio
      : state.audio;

    const rgb = renderGenerativeFrame(state.layers, droneCount, newTime, audio);
    const hex = rgb.map(c => rgbToHex(c));

    set({
      time: newTime,
      outputColors: hex,
      outputRGB: rgb,
    });
  },
}));

export default useGenerativeStore;
