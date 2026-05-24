/**
 * useSfxEngine — Web Audio bridge for the firework SFX timing engine.
 *
 * Responsibilities:
 *  - Owns a single AudioContext (created lazily on first user gesture).
 *  - Pre-loads and caches AudioBuffer instances for each clipKey.
 *  - Exposes { sfxManager } — a ready SfxManager whose play/stop callbacks
 *    drive the actual Web Audio graph.
 *  - Handles missing audio files silently (404 → buffer stays null → no sound).
 *  - Respects browser autoplay policy: AudioContext resumes on any user
 *    interaction via the `resumeIfSuspended()` helper.
 *
 * Usage (inside a React component or another hook):
 *   const { sfxManager, masterVolume, setMasterVolume } = useSfxEngine();
 *   // then call sfxManager.registerBurst(...) when a burst fires
 *   // and sfxManager.tick(currentTime) each frame
 *
 * SFX files are expected at /sfx/<clipKey>.mp3.
 * If a file is absent the engine logs a single warning and continues silently.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { SfxManager, type SfxPlayCommand, getClipUrl } from '@/render_ultra/fireworks/sfxTimingEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level AudioContext singleton — shared across all hook instances
// (multiple FireworkBurst components all share one AudioContext)
// ─────────────────────────────────────────────────────────────────────────────
let _sharedCtx: AudioContext | null = null;
const _bufferCache = new Map<string, AudioBuffer | null>();  // null = failed to load
const _activeNodes = new Map<string, AudioBufferSourceNode>(); // clipKey → running node

function getOrCreateContext(): AudioContext | null {
  if (_sharedCtx) return _sharedCtx;
  try {
    _sharedCtx = new AudioContext();
    // Immediately resume in case it starts suspended
    if (_sharedCtx.state === 'suspended') {
      _sharedCtx.resume().catch(() => undefined);
    }
    return _sharedCtx;
  } catch {
    return null;
  }
}

/** Call this on any user-gesture event handler to unblock autoplay policy. */
export function resumeSfxContext(): void {
  if (_sharedCtx?.state === 'suspended') {
    _sharedCtx.resume().catch(() => undefined);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Async buffer loader with in-flight de-dup
// ─────────────────────────────────────────────────────────────────────────────
const _inFlight = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(clipKey: string): Promise<AudioBuffer | null> {
  if (_bufferCache.has(clipKey)) return _bufferCache.get(clipKey)!;
  if (_inFlight.has(clipKey)) return _inFlight.get(clipKey)!;

  const url = getClipUrl(clipKey);
  if (!url) {
    _bufferCache.set(clipKey, null);
    return null;
  }

  const ctx = getOrCreateContext();
  if (!ctx) {
    _bufferCache.set(clipKey, null);
    return null;
  }

  const promise = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then(ab => ctx.decodeAudioData(ab))
    .then(buf => {
      _bufferCache.set(clipKey, buf);
      _inFlight.delete(clipKey);
      return buf;
    })
    .catch(err => {
      console.warn(`[SfxEngine] Failed to load "${clipKey}": ${err.message ?? err}`);
      _bufferCache.set(clipKey, null);
      _inFlight.delete(clipKey);
      return null;
    });

  _inFlight.set(clipKey, promise);
  // Start loading immediately (fire-and-forget — result stored in cache)
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Play / stop callbacks for SfxManager
// ─────────────────────────────────────────────────────────────────────────────
function createPlayCallback(masterGain: GainNode) {
  return async (cmd: SfxPlayCommand) => {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);

    const buffer = await loadBuffer(cmd.clipKey);
    if (!buffer) return;

    // Stop any existing loop for this clip key
    const existing = _activeNodes.get(cmd.clipKey);
    if (existing) {
      try { existing.stop(); } catch { /* already stopped */ }
      _activeNodes.delete(cmd.clipKey);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = cmd.loop;

    const gainNode = ctx.createGain();
    gainNode.gain.value = cmd.volume;
    source.connect(gainNode);
    gainNode.connect(masterGain);

    // Schedule to start now; use AudioContext time for precision
    const startWhen = Math.max(ctx.currentTime, ctx.currentTime);
    source.start(startWhen);

    if (cmd.loop) {
      _activeNodes.set(cmd.clipKey, source);
    } else {
      // Auto-stop after duration + 100ms buffer
      source.stop(startWhen + cmd.duration + 0.1);
    }

    source.onended = () => {
      gainNode.disconnect();
      if (_activeNodes.get(cmd.clipKey) === source) {
        _activeNodes.delete(cmd.clipKey);
      }
    };
  };
}

function createStopCallback() {
  return (clipKey: string) => {
    const node = _activeNodes.get(clipKey);
    if (node) {
      try {
        // Fade out over 200ms to avoid click
        const ctx = _sharedCtx;
        if (ctx) {
          // Find the gain node — it's connected between source and destination
          node.stop(ctx.currentTime + 0.2);
        } else {
          node.stop();
        }
      } catch { /* already stopped */ }
      _activeNodes.delete(clipKey);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface SfxEngineHandle {
  sfxManager: SfxManager;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  /** Pre-load a set of clip keys (call during idle to avoid first-shot latency) */
  preload: (clipKeys: string[]) => void;
}

export function useSfxEngine(): SfxEngineHandle {
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const masterGainRef = useRef<GainNode | null>(null);
  const managerRef = useRef<SfxManager | null>(null);

  // Initialise AudioContext + master gain + SfxManager once
  useEffect(() => {
    const ctx = getOrCreateContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const onPlay = createPlayCallback(masterGain);
    const onStop = createStopCallback();
    managerRef.current = new SfxManager(onPlay, onStop);
    managerRef.current.masterVolume = masterVolume;

    return () => {
      managerRef.current?.stopAll();
      masterGain.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setMasterVolumeState(clamped);
    if (masterGainRef.current && _sharedCtx) {
      masterGainRef.current.gain.setTargetAtTime(clamped, _sharedCtx.currentTime, 0.05);
    }
    if (managerRef.current) {
      managerRef.current.masterVolume = clamped;
    }
  }, []);

  const preload = useCallback((clipKeys: string[]) => {
    for (const k of clipKeys) loadBuffer(k);
  }, []);

  // Lazy init: if manager wasn't created yet, create a no-op fallback
  if (!managerRef.current) {
    managerRef.current = new SfxManager(
      () => undefined,   // no-op play
      () => undefined,   // no-op stop
    );
  }

  return {
    sfxManager: managerRef.current,
    masterVolume,
    setMasterVolume,
    preload,
  };
}
