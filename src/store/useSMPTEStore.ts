import { create } from 'zustand';
import {
  type SMPTESyncState,
  type SMPTEFrameRate,
  type SMPTETimecode,
  DEFAULT_SYNC_STATE,
  updateSyncState,
  secondsToTimecode,
  formatTimecode,
  encodeTimecodeToLTC,
  timecodeToSeconds,
} from '@/lib/smpteEngine';
import { useProjectStore } from '@/store/useProjectStore';

interface SMPTEStoreState extends SMPTESyncState {
  // Start timecode offset (e.g., show starts at 01:00:00:00)
  startTimecodeSeconds: number;
  // Auto-follow project playback
  autoFollow: boolean;
  // LTC audio output enabled
  ltcAudioEnabled: boolean;
  // Internal refs
  _audioCtx: AudioContext | null;
  _ltcInterval: ReturnType<typeof setInterval> | null;

  setMode: (mode: 'master' | 'slave' | 'freerun') => void;
  setFrameRate: (fps: SMPTEFrameRate) => void;
  setRunning: (running: boolean) => void;
  setAutoFollow: (v: boolean) => void;
  setStartTimecode: (tc: string) => void;
  setStartTimecodeSeconds: (s: number) => void;
  setLtcAudioEnabled: (v: boolean) => void;
  tick: (currentTimeSeconds: number, externalTimeSeconds?: number) => void;
  reset: () => void;
  getDisplayTimecode: () => SMPTETimecode;
  getDisplayString: () => string;
  startLtcAudio: () => void;
  stopLtcAudio: () => void;
}

export const useSMPTEStore = create<SMPTEStoreState>((set, get) => ({
  ...DEFAULT_SYNC_STATE,
  startTimecodeSeconds: 0,
  autoFollow: true,
  ltcAudioEnabled: false,
  _audioCtx: null,
  _ltcInterval: null,

  setMode: (mode) => set({ mode }),
  setFrameRate: (fps) => set({ frameRate: fps, timecode: { ...get().timecode, frameRate: fps } }),
  setRunning: (running) => {
    set({ running });
    if (running && get().ltcAudioEnabled) get().startLtcAudio();
    if (!running) get().stopLtcAudio();
  },
  setAutoFollow: (v) => set({ autoFollow: v }),
  setStartTimecodeSeconds: (s) => set({ startTimecodeSeconds: s }),
  setStartTimecode: (tcStr) => {
    const state = get();
    // Parse HH:MM:SS:FF format
    const parts = tcStr.replace(/;/g, ':').split(':').map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      const fps = state.frameRate === 29.97 ? 30 : state.frameRate;
      const totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / fps;
      set({ startTimecodeSeconds: totalSeconds });
    }
  },
  setLtcAudioEnabled: (v) => {
    set({ ltcAudioEnabled: v });
    if (v && get().running) get().startLtcAudio();
    if (!v) get().stopLtcAudio();
  },

  tick: (currentTimeSeconds, externalTimeSeconds) => {
    const state = get();
    const offsetTime = currentTimeSeconds + state.startTimecodeSeconds;
    const updated = updateSyncState(state, offsetTime, externalTimeSeconds);
    set(updated);
  },

  reset: () => {
    get().stopLtcAudio();
    set({ ...DEFAULT_SYNC_STATE, startTimecodeSeconds: 0, autoFollow: true, ltcAudioEnabled: false, _audioCtx: null, _ltcInterval: null });
  },

  getDisplayTimecode: () => {
    const state = get();
    const t = useProjectStore.getState().currentTime + state.startTimecodeSeconds;
    return secondsToTimecode(t, state.frameRate, state.frameRate === 29.97);
  },

  getDisplayString: () => {
    return formatTimecode(get().getDisplayTimecode());
  },

  startLtcAudio: () => {
    const state = get();
    if (state._audioCtx) return; // already running

    try {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3; // LTC level
      gainNode.connect(ctx.destination);

      const interval = setInterval(() => {
        const s = get();
        if (!s.running || !s.ltcAudioEnabled) return;

        const tc = s.timecode;
        const ltc = encodeTimecodeToLTC(tc);

        // Play LTC audio for one frame
        const buffer = ctx.createBuffer(1, ltc.audioSamples.length, 48000);
        buffer.getChannelData(0).set(ltc.audioSamples);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.start();
      }, 1000 / (state.frameRate === 29.97 ? 30 : state.frameRate));

      set({ _audioCtx: ctx, _ltcInterval: interval });
    } catch (e) {
      console.warn('Failed to create LTC audio context:', e);
    }
  },

  stopLtcAudio: () => {
    const state = get();
    if (state._ltcInterval) clearInterval(state._ltcInterval);
    if (state._audioCtx) {
      try { state._audioCtx.close(); } catch {}
    }
    set({ _audioCtx: null, _ltcInterval: null });
  },
}));

// ── Auto-follow: subscribe to project playback state ──
let _syncInterval: ReturnType<typeof setInterval> | null = null;

useProjectStore.subscribe((state, prev) => {
  const smpte = useSMPTEStore.getState();
  if (!smpte.autoFollow) return;

  // Auto start/stop SMPTE when project plays/stops
  if (state.isPlaying && !prev.isPlaying) {
    useSMPTEStore.getState().setRunning(true);
  }
  if (!state.isPlaying && prev.isPlaying) {
    useSMPTEStore.getState().setRunning(false);
  }
});

// Continuous tick at ~30Hz when running
setInterval(() => {
  const smpte = useSMPTEStore.getState();
  if (!smpte.running) return;
  const t = useProjectStore.getState().currentTime;
  const external = smpte.mode === 'slave' ? t + (Math.random() - 0.5) * 0.002 : undefined;
  smpte.tick(t, external);
}, 33);
