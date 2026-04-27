/**
 * ─── simulationStore ──────────────────────────────────────────────
 * Macro-store consolidating WebGPU kernel state, boids/laser physics,
 * viewport/camera, replay buffer, and Honest Hardware mode flag.
 *
 * SLICE TOPOLOGY (minimize subscription fan-out):
 *   • mode      — simulationMode, honestHardwareEnabled, viewportMode (PERSISTED)
 *   • compute   — webgpuReady, computePassCount (HIGH frequency, every frame)
 *   • physics   — boidsConfig (mid frequency, edits)
 *   • replay    — replayBufferSize, replayPlaying (mid frequency)
 *
 * Critical: `computePassCount` ticks every frame. UI must NEVER
 * subscribe to the full state — use `useSimulationMode()` etc.
 */
import { useShallow } from 'zustand/react/shallow';
import { createStore } from './createStore';

export type SimulationMode = 'live' | 'simulated' | 'replay';
export type ViewportMode = 'editor' | 'walk' | 'studio';

export interface SimulationModeSlice {
  simulationMode: SimulationMode;
  honestHardwareEnabled: boolean;
  viewportMode: ViewportMode;
}

export interface SimulationComputeSlice {
  webgpuReady: boolean;
  computePassCount: number;
}

export interface SimulationPhysicsSlice {
  boidsConfig: { count: number; speed: number } | null;
}

export interface SimulationReplaySlice {
  replayBufferSize: number;
  replayPlaying: boolean;
}

export interface SimulationActions {
  setWebgpuReady: (ready: boolean) => void;
  tickComputePass: () => void;
  toggleMode: (mode: SimulationMode) => void;
  setViewportMode: (mode: ViewportMode) => void;
  enableHonestHardware: (enabled: boolean) => void;
  setBoidsConfig: (cfg: SimulationPhysicsSlice['boidsConfig']) => void;
  setReplayBufferSize: (n: number) => void;
  setReplayPlaying: (playing: boolean) => void;
}

export type SimulationState =
  & SimulationModeSlice
  & SimulationComputeSlice
  & SimulationPhysicsSlice
  & SimulationReplaySlice
  & SimulationActions;

export const useSimulationStore = createStore<SimulationState>(
  'simulation',
  (set) => ({
    // mode (durable)
    simulationMode: 'simulated',
    honestHardwareEnabled: true, // Honest by default per project memory
    viewportMode: 'editor',
    // compute (hot)
    webgpuReady: false,
    computePassCount: 0,
    // physics
    boidsConfig: null,
    // replay
    replayBufferSize: 0,
    replayPlaying: false,

    setWebgpuReady: (ready) => set((s) => { s.webgpuReady = ready; }),
    tickComputePass: () => set((s) => { s.computePassCount += 1; }),
    toggleMode: (mode) => set((s) => { s.simulationMode = mode; }),
    setViewportMode: (mode) => set((s) => { s.viewportMode = mode; }),
    enableHonestHardware: (enabled) => set((s) => { s.honestHardwareEnabled = enabled; }),
    setBoidsConfig: (cfg) => set((s) => { s.boidsConfig = cfg; }),
    setReplayBufferSize: (n) => set((s) => { s.replayBufferSize = n; }),
    setReplayPlaying: (playing) => set((s) => { s.replayPlaying = playing; }),
  }),
  {
    // Aggressive partialize: only mode slice persists.
    partialize: (state) => ({
      simulationMode: state.simulationMode,
      honestHardwareEnabled: state.honestHardwareEnabled,
      viewportMode: state.viewportMode,
    }),
  },
);

// ── Slice selectors ──────────────────────────────────────────────
export const useSimulationMode = () =>
  useSimulationStore(useShallow((s): SimulationModeSlice => ({
    simulationMode: s.simulationMode,
    honestHardwareEnabled: s.honestHardwareEnabled,
    viewportMode: s.viewportMode,
  })));

export const useSimulationCompute = () =>
  useSimulationStore(useShallow((s): SimulationComputeSlice => ({
    webgpuReady: s.webgpuReady,
    computePassCount: s.computePassCount,
  })));

export const useSimulationPhysics = () =>
  useSimulationStore(useShallow((s): SimulationPhysicsSlice => ({
    boidsConfig: s.boidsConfig,
  })));

export const useSimulationReplay = () =>
  useSimulationStore(useShallow((s): SimulationReplaySlice => ({
    replayBufferSize: s.replayBufferSize,
    replayPlaying: s.replayPlaying,
  })));

export const useSimulationActions = (): SimulationActions =>
  useSimulationStore(useShallow((s) => ({
    setWebgpuReady: s.setWebgpuReady,
    tickComputePass: s.tickComputePass,
    toggleMode: s.toggleMode,
    setViewportMode: s.setViewportMode,
    enableHonestHardware: s.enableHonestHardware,
    setBoidsConfig: s.setBoidsConfig,
    setReplayBufferSize: s.setReplayBufferSize,
    setReplayPlaying: s.setReplayPlaying,
  })));
