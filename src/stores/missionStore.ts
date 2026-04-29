/**
 * ─── missionStore ─────────────────────────────────────────────────
 * Macro-store consolidating: timeline, cues, sequences, playback,
 * execution, show, scheduler, safetyLock.
 *
 * SLICE TOPOLOGY (minimize subscription fan-out):
 *   • durable   — show metadata, safety status, Grok outcome (PERSISTED)
 *   • timeline  — timeline + activeCues (mid-frequency, edits)
 *   • playback  — playheadSec + playbackState (HIGH frequency, 60-120Hz scrub)
 *
 * Hot-path consumers (Timeline ruler, Transport HUD) MUST subscribe via
 * `useMissionPlayback()` — a `useShallow` selector that only fires when
 * the playback slice itself changes. Heavy panels (Show inspector,
 * Safety badge) subscribe to `useMissionDurable()` and never re-render
 * during scrub.
 */
import { useShallow } from 'zustand/react/shallow';
import { createStore } from './createStore';

export type PlaybackState = 'stopped' | 'playing' | 'paused';
export type SafetyInterlock = 'locked' | 'armed';

export interface MissionDurableSlice {
  currentShow: { id: string; name: string } | null;
  safetyInterlockStatus: SafetyInterlock;
  lastGrokOutcome: string | null;
  lastGrokRequestId: string | null;
}

export interface MissionTimelineSlice {
  timeline: Array<{ id: string; t: number; cueId: string }>;
  activeCues: string[];
}

export interface MissionPlaybackSlice {
  playbackState: PlaybackState;
  playheadSec: number;
}

export interface MissionActions {
  loadShow: (show: MissionDurableSlice['currentShow']) => void;
  setTimeline: (items: MissionTimelineSlice['timeline']) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setPlayhead: (sec: number) => void;
  fireCue: (cueId: string) => void;
  clearActiveCues: () => void;
  updateSafetyStatus: (status: SafetyInterlock) => void;
  registerGrokChoreography: (outcome: string, requestId?: string) => void;
}

export type MissionState =
  & MissionDurableSlice
  & MissionTimelineSlice
  & MissionPlaybackSlice
  & MissionActions;

export const useMissionStore = createStore<MissionState>(
  'mission',
  (set) => ({
    // durable
    currentShow: null,
    safetyInterlockStatus: 'locked',
    lastGrokOutcome: null,
    lastGrokRequestId: null,
    // timeline
    timeline: [],
    activeCues: [],
    // playback
    playbackState: 'stopped',
    playheadSec: 0,

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
    // Aggressive partialize: ONLY durable slice persists.
    // Timeline (large) and playback (transient) never hit localStorage.
    partialize: (state) => ({
      currentShow: state.currentShow,
      safetyInterlockStatus: state.safetyInterlockStatus,
      lastGrokOutcome: state.lastGrokOutcome,
      lastGrokRequestId: state.lastGrokRequestId,
    }),
  },
);

// ── Slice selectors (shallow-equality) ────────────────────────────
export const useMissionDurable = () =>
  useMissionStore(useShallow((s): MissionDurableSlice => ({
    currentShow: s.currentShow,
    safetyInterlockStatus: s.safetyInterlockStatus,
    lastGrokOutcome: s.lastGrokOutcome,
    lastGrokRequestId: s.lastGrokRequestId,
  })));

export const useMissionTimeline = () =>
  useMissionStore(useShallow((s): MissionTimelineSlice => ({
    timeline: s.timeline,
    activeCues: s.activeCues,
  })));

export const useMissionPlayback = () =>
  useMissionStore(useShallow((s): MissionPlaybackSlice => ({
    playbackState: s.playbackState,
    playheadSec: s.playheadSec,
  })));

export const useMissionActions = (): MissionActions =>
  useMissionStore(useShallow((s) => ({
    loadShow: s.loadShow,
    setTimeline: s.setTimeline,
    play: s.play,
    pause: s.pause,
    stop: s.stop,
    setPlayhead: s.setPlayhead,
    fireCue: s.fireCue,
    clearActiveCues: s.clearActiveCues,
    updateSafetyStatus: s.updateSafetyStatus,
    registerGrokChoreography: s.registerGrokChoreography,
  })));
