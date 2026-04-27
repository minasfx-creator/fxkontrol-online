/**
 * ─── missionStore ─────────────────────────────────────────────────
 * Macro-store consolidating: timeline, cues, sequences, playback,
 * execution, show, scheduler, safetyLock.
 *
 * Status: SCAFFOLD. Slices are wired with minimal state so consumers
 * can start importing. Legacy stores remain the source of truth until
 * `useUIWorkspaceStore.featureFlags.consolidatedStores === true` and
 * `migrateLegacyStores()` has copied state across.
 */
import { createStore } from './createStore';

export type PlaybackState = 'stopped' | 'playing' | 'paused';
export type SafetyInterlock = 'locked' | 'armed';

export interface MissionState {
  // ── Show / timeline slice ────────────────────────────────────────
  currentShow: { id: string; name: string } | null;
  timeline: Array<{ id: string; t: number; cueId: string }>;
  activeCues: string[];

  // ── Playback slice ───────────────────────────────────────────────
  playbackState: PlaybackState;
  playheadSec: number;

  // ── Safety gate slice ────────────────────────────────────────────
  safetyInterlockStatus: SafetyInterlock;

  // ── Grok mission outcome slice ───────────────────────────────────
  lastGrokOutcome: string | null;
  lastGrokRequestId: string | null;

  // ── Actions ──────────────────────────────────────────────────────
  loadShow: (show: MissionState['currentShow']) => void;
  setTimeline: (items: MissionState['timeline']) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setPlayhead: (sec: number) => void;
  fireCue: (cueId: string) => void;
  clearActiveCues: () => void;
  updateSafetyStatus: (status: SafetyInterlock) => void;
  registerGrokChoreography: (outcome: string, requestId?: string) => void;
}

export const useMissionStore = createStore<MissionState>(
  'mission',
  (set) => ({
    currentShow: null,
    timeline: [],
    activeCues: [],
    playbackState: 'stopped',
    playheadSec: 0,
    safetyInterlockStatus: 'locked',
    lastGrokOutcome: null,
    lastGrokRequestId: null,

    loadShow: (show) => set((s) => { s.currentShow = show; }),
    setTimeline: (items) => set((s) => { s.timeline = items; }),
    play: () => set((s) => { s.playbackState = 'playing'; }),
    pause: () => set((s) => { s.playbackState = 'paused'; }),
    stop: () => set((s) => { s.playbackState = 'stopped'; s.playheadSec = 0; }),
    setPlayhead: (sec) => set((s) => { s.playheadSec = sec; }),
    fireCue: (cueId) => set((s) => {
      if (!s.activeCues.includes(cueId)) s.activeCues.push(cueId);
    }),
    clearActiveCues: () => set((s) => { s.activeCues = []; }),
    updateSafetyStatus: (status) => set((s) => { s.safetyInterlockStatus = status; }),
    registerGrokChoreography: (outcome, requestId) => set((s) => {
      s.lastGrokOutcome = outcome;
      s.lastGrokRequestId = requestId ?? null;
    }),
  }),
  {
    partialize: (state) => ({
      currentShow: state.currentShow,
      safetyInterlockStatus: state.safetyInterlockStatus,
      lastGrokOutcome: state.lastGrokOutcome,
      lastGrokRequestId: state.lastGrokRequestId,
    }),
  },
);
