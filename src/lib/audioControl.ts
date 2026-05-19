/**
 * Tiny pub/sub for transient audio playback controls (volume + mute) that
 * survive Timeline mount/unmount. Persisted to localStorage so the user's
 * preference sticks across reloads.
 *
 * Owners:
 *  - AudioEngine (headless) subscribes and applies to the <audio> element.
 *  - AudioWaveform UI calls setVolume / setMuted.
 */

const STORAGE_KEY = 'fxk.audio.control.v1';

interface AudioControl {
  volume: number; // 0..1
  muted: boolean;
}

function load(): AudioControl {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioControl>;
      return {
        volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : 0.8,
        muted: !!parsed.muted,
      };
    }
  } catch { /* ignore */ }
  return { volume: 0.8, muted: false };
}

let state: AudioControl = load();
const listeners = new Set<(s: AudioControl) => void>();

function persist() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch { /* quota / private-mode */ }
}

function emit() {
  for (const l of listeners) l(state);
}

export function getAudioControl(): AudioControl {
  return state;
}

export function setAudioVolume(v: number) {
  const next = Math.min(1, Math.max(0, v));
  if (next === state.volume) return;
  state = { ...state, volume: next };
  persist();
  emit();
}

export function setAudioMuted(m: boolean) {
  if (m === state.muted) return;
  state = { ...state, muted: m };
  persist();
  emit();
}

export function subscribeAudioControl(fn: (s: AudioControl) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
