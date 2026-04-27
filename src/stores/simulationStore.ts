/**
 * ─── simulationStore ──────────────────────────────────────────────
 * Macro-store consolidating WebGPU kernel state, boids/laser physics,
 * viewport/camera, replay buffer, and Honest Hardware mode flag.
 *
 * Status: SCAFFOLD. The WebGPU Unified Compute Kernel (WGSL v3, RT3+RT4)
 * stays in src/render_ultra/ — this store only mirrors the *control
 * surface* (mode, ready flag, replay handle) so UI panels can subscribe
 * without reaching into the renderer directly.
 */
import { createStore } from './createStore';

export type SimulationMode = 'live' | 'simulated' | 'replay';
export type ViewportMode = 'editor' | 'walk' | 'studio';

export interface SimulationState {
  // ── WebGPU slice (control surface only) ──────────────────────────
  webgpuReady: boolean;
  computePassCount: number;

  // ── Mode slice ───────────────────────────────────────────────────
  simulationMode: SimulationMode;
  honestHardwareEnabled: boolean;

  // ── Viewport slice ───────────────────────────────────────────────
  viewportMode: ViewportMode;

  // ── Physics slice (boids/laser params, sparse) ───────────────────
  boidsConfig: { count: number; speed: number } | null;

  // ── Replay slice ─────────────────────────────────────────────────
  replayBufferSize: number;
  replayPlaying: boolean;

  // ── Actions ──────────────────────────────────────────────────────
  setWebgpuReady: (ready: boolean) => void;
  tickComputePass: () => void;
  toggleMode: (mode: SimulationMode) => void;
  setViewportMode: (mode: ViewportMode) => void;
  enableHonestHardware: (enabled: boolean) => void;
  setBoidsConfig: (cfg: SimulationState['boidsConfig']) => void;
  setReplayBufferSize: (n: number) => void;
  setReplayPlaying: (playing: boolean) => void;
}

export const useSimulationStore = createStore<SimulationState>(
  'simulation',
  (set) => ({
    webgpuReady: false,
    computePassCount: 0,
    simulationMode: 'simulated',
    honestHardwareEnabled: true, // Honest by default per project memory
    viewportMode: 'editor',
    boidsConfig: null,
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
    partialize: (state) => ({
      simulationMode: state.simulationMode,
      honestHardwareEnabled: state.honestHardwareEnabled,
      viewportMode: state.viewportMode,
    }),
  },
);
