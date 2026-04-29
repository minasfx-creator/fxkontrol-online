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
  parseTimecode,
} from '@/lib/smpteEngine';
import { useProjectStore } from '@/store/useProjectStore';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { resolveSMPTEChase } from '@/core/timeline/smpteChase';
import { ltcRuntime, updateTimelineClockFromLTCFps } from '@/hardware/transports/ltcRuntime';

export type ExternalSyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ChaseMode = 'tight' | 'smooth' | 'freewheel' | 'external-master';

interface ExternalSyncState {
  externalEnabled: boolean;
  wsUrl: string;
  status: ExternalSyncStatus;
  chaseMode: ChaseMode;
  externalTimecode: SMPTETimecode | null;
  externalTimeSeconds: number;
  latency: number;
  packetCount: number;
  lastPacketAt: number;
  _ws: WebSocket | null;
  _pingInterval: ReturnType<typeof setInterval> | null;
  _reconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface SMPTEStoreState extends SMPTESyncState, ExternalSyncState {
  startTimecodeSeconds: number;
  autoFollow: boolean;
  ltcAudioEnabled: boolean;
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

  // External sync
  setExternalEnabled: (v: boolean) => void;
  setWsUrl: (url: string) => void;
  setChaseMode: (mode: ChaseMode) => void;
  connectExternal: () => void;
  disconnectExternal: () => void;
  _handleExternalMessage: (data: any) => void;
}

const DEFAULT_WS_URL = '';

export const useSMPTEStore = create<SMPTEStoreState>((set, get) => ({
  ...DEFAULT_SYNC_STATE,
  startTimecodeSeconds: 0,
  autoFollow: true,
  ltcAudioEnabled: false,
  _audioCtx: null,
  _ltcInterval: null,

  // External sync defaults
  externalEnabled: false,
  wsUrl: DEFAULT_WS_URL,
  status: 'disconnected',
  chaseMode: 'smooth',
  externalTimecode: null,
  externalTimeSeconds: 0,
  latency: 0,
  packetCount: 0,
  lastPacketAt: 0,
  _ws: null,
  _pingInterval: null,
  _reconnectTimeout: null,

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
    
    // If in slave mode with external sync, use external time
    const extTime = state.externalEnabled && state.status === 'connected' && state.mode === 'slave'
      ? state.externalTimeSeconds
      : externalTimeSeconds;
    
    const updated = updateSyncState(state, offsetTime, extTime);
    set(updated);
  },

  reset: () => {
    get().stopLtcAudio();
    get().disconnectExternal();
    set({
      ...DEFAULT_SYNC_STATE,
      startTimecodeSeconds: 0,
      autoFollow: true,
      ltcAudioEnabled: false,
      _audioCtx: null,
      _ltcInterval: null,
      externalEnabled: false,
      status: 'disconnected',
      externalTimecode: null,
      externalTimeSeconds: 0,
      latency: 0,
      packetCount: 0,
      lastPacketAt: 0,
      _ws: null,
      _pingInterval: null,
      _reconnectTimeout: null,
    });
  },

  getDisplayTimecode: () => {
    const state = get();
    // In slave mode with external TC, show external TC
    if (state.externalEnabled && state.status === 'connected' && state.mode === 'slave' && state.externalTimecode) {
      return state.externalTimecode;
    }
    const t = timelineClock.getTime() + state.startTimecodeSeconds;
    return secondsToTimecode(t, state.frameRate, state.frameRate === 29.97);
  },

  getDisplayString: () => {
    return formatTimecode(get().getDisplayTimecode());
  },

  startLtcAudio: () => {
    const state = get();
    if (state._audioCtx) return;
    try {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3;
      gainNode.connect(ctx.destination);
      const interval = setInterval(() => {
        const s = get();
        if (!s.running || !s.ltcAudioEnabled) return;
        const tc = s.timecode;
        const ltc = encodeTimecodeToLTC(tc);
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
      try { state._audioCtx.close(); } catch { /* best-effort: AudioContext may already be closed */ }
    }
    set({ _audioCtx: null, _ltcInterval: null });
  },

  // ── External Sync ──────────────────────────────────

  setExternalEnabled: (v) => {
    set({ externalEnabled: v });
    if (v) {
      get().connectExternal();
    } else {
      get().disconnectExternal();
    }
  },

  setWsUrl: (url) => set({ wsUrl: url }),

  setChaseMode: (mode) => set({ chaseMode: mode }),

  connectExternal: () => {
    const state = get();
    // Clean up existing connection
    if (state._ws) {
      try { state._ws.close(); } catch { /* best-effort: WebSocket may already be closed */ }
    }
    if (state._pingInterval) clearInterval(state._pingInterval);
    if (state._reconnectTimeout) clearTimeout(state._reconnectTimeout);

    if (!state.wsUrl) {
      set({ status: 'error' });
      return;
    }

    set({ status: 'connecting' });

    try {
      const ws = new WebSocket(state.wsUrl);

      ws.onopen = () => {
        set({ status: 'connected', packetCount: 0 });
        // Set role to receiver
        ws.send(JSON.stringify({ type: 'set_role', role: 'receiver' }));
        // Start ping for latency measurement
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 2000);
        set({ _pingInterval: pingInterval });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          get()._handleExternalMessage(data);
        } catch { /* best-effort: malformed external message ignored */ }
      };

      ws.onerror = () => {
        set({ status: 'error' });
      };

      ws.onclose = () => {
        const s = get();
        if (s._pingInterval) clearInterval(s._pingInterval);
        set({ status: 'disconnected', _ws: null, _pingInterval: null });
        // Auto-reconnect if still enabled
        if (s.externalEnabled) {
          const timeout = setTimeout(() => {
            if (get().externalEnabled) get().connectExternal();
          }, 3000);
          set({ _reconnectTimeout: timeout });
        }
      };

      set({ _ws: ws });
    } catch {
      set({ status: 'error' });
    }
  },

  disconnectExternal: () => {
    const state = get();
    if (state._ws) {
      try { state._ws.close(); } catch { /* best-effort: WebSocket may already be closed */ }
    }
    if (state._pingInterval) clearInterval(state._pingInterval);
    if (state._reconnectTimeout) clearTimeout(state._reconnectTimeout);
    set({
      status: 'disconnected',
      _ws: null,
      _pingInterval: null,
      _reconnectTimeout: null,
      externalTimecode: null,
    });
  },

  _handleExternalMessage: (data) => {
    const state = get();

    switch (data.type) {
      case 'tc': {
        const extTc: SMPTETimecode = {
          hours: data.hours ?? 0,
          minutes: data.minutes ?? 0,
          seconds: data.seconds ?? 0,
          frames: data.frames ?? 0,
          frameRate: (data.fps ?? 30) as SMPTEFrameRate,
          dropFrame: data.dropFrame ?? false,
        };
        const extSeconds = timecodeToSeconds(extTc);
        const projectTime = extSeconds - state.startTimecodeSeconds;
        const nextPacketCount = state.packetCount + 1;

        set({
          externalTimecode: extTc,
          externalTimeSeconds: extSeconds,
          packetCount: nextPacketCount,
          lastPacketAt: Date.now(),
        });

        ltcRuntime.ingestTime(extSeconds, Date.now(), data.source ?? 'ws', data.priority ?? 0);
        updateTimelineClockFromLTCFps();

        // Chase: drive project playback from external TC
        if (state.mode === 'slave') {
          const projectStore = useProjectStore.getState();
          const currentProjectTime = timelineClock.getTime();
          const boundedProjectTime = Math.max(0, Math.min(projectTime, projectStore.duration));
          const chase = resolveSMPTEChase(currentProjectTime, boundedProjectTime);

          if (!timelineClock.isPlaying()) {
            timelineClock.seek(chase.mode === 'ignore' ? currentProjectTime : chase.nextTime);
            break;
          }

          ltcRuntime.setChaseMode(state.chaseMode);

          switch (state.chaseMode) {
            case 'tight':
              if (chase.mode !== 'ignore') {
                timelineClock.syncExternalTime(chase.nextTime);
              }
              if (!projectStore.isPlaying && projectTime > 0) {
                timelineClock.play();
              }
              break;

            case 'smooth':
              if (chase.mode === 'snap' || chase.mode === 'soft') {
                timelineClock.syncExternalTime(chase.nextTime);
              }
              if (!projectStore.isPlaying && projectTime > 0.1) {
                timelineClock.play();
              }
              break;

            case 'freewheel':
              if (nextPacketCount === 1 || chase.mode === 'snap') {
                timelineClock.syncExternalTime(chase.mode === 'ignore' ? currentProjectTime : chase.nextTime);
              }
              if (!projectStore.isPlaying && projectTime > 0.1) {
                timelineClock.play();
              }
              break;

            case 'external-master':
              timelineClock.syncExternalTime(boundedProjectTime);
              if (!projectStore.isPlaying) {
                timelineClock.play();
              }
              break;
          }
        }
        break;
      }

      case 'transport': {
        if (state.mode === 'slave') {
          const projectStore = useProjectStore.getState();
          switch (data.command) {
            case 'play':
              if (!projectStore.isPlaying) timelineClock.play();
              break;
            case 'stop':
              if (projectStore.isPlaying) timelineClock.pause();
              break;
            case 'locate':
              if (typeof data.position === 'number') {
                timelineClock.syncExternalTime(Math.max(0, Math.min(data.position, projectStore.duration)));
              }
              break;
          }
        }
        break;
      }

      case 'pong': {
        const latency = (Date.now() - (data.clientTimestamp ?? Date.now())) / 2;
        set({ latency });
        break;
      }

      case 'welcome': {
        console.log(`TC Bridge connected — clientId: ${data.clientId}, peers: ${data.connectedClients}`);
        break;
      }
    }
  },
}));

// ── Auto-follow: subscribe to project playback state ──
useProjectStore.subscribe((state, prev) => {
  const smpte = useSMPTEStore.getState();
  if (!smpte.autoFollow) return;
  if (smpte.mode === 'slave' && smpte.externalEnabled) return; // don't auto-follow in slave mode

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
  const t = timelineClock.getTime();
  const external = smpte.mode === 'slave' && smpte.externalEnabled && smpte.status === 'connected'
    ? smpte.externalTimeSeconds
    : smpte.mode === 'slave' ? t + (Math.random() - 0.5) * 0.002 : undefined;
  smpte.tick(t, external);
}, 33);
