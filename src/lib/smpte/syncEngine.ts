/**
 * SMPTE Sync Engine — high-resolution sync with pre-allocated state.
 */

import { type SMPTEFrameRate, type SMPTETimecode, secondsToTimecodeFast, copyTimecode } from './timecodeCore';

export interface SMPTESyncState {
  mode: 'master' | 'slave' | 'freerun';
  locked: boolean;
  offset: number;
  drift: number;
  lastSync: number;
  jitter: number;
  frameRate: SMPTEFrameRate;
  timecode: SMPTETimecode;
  running: boolean;
}

export const DEFAULT_SYNC_STATE: SMPTESyncState = {
  mode: 'master',
  locked: false,
  offset: 0,
  drift: 0,
  lastSync: 0,
  jitter: 0,
  frameRate: 30,
  timecode: { hours: 0, minutes: 0, seconds: 0, frames: 0, dropFrame: false, frameRate: 30 },
  running: false,
};

// ── Pre-allocated jitter RNG state (avoid Math.random alloc overhead) ──
let _jitterSeed = Date.now();
function fastJitter(): number {
  _jitterSeed = (_jitterSeed * 1664525 + 1013904223) & 0x7FFFFFFF;
  return ((_jitterSeed / 0x7FFFFFFF) - 0.5) * 1.0;
}

/**
 * Update sync state in-place for zero-GC hot path.
 * Returns the same state object (mutated).
 */
export function updateSyncStateInPlace(
  state: SMPTESyncState,
  currentTimeSeconds: number,
  externalTimeSeconds?: number,
): SMPTESyncState {
  // Use fast scratch timecode (no allocation)
  const tc = secondsToTimecodeFast(currentTimeSeconds, state.frameRate, state.frameRate === 29.97);
  copyTimecode(tc, state.timecode);

  state.jitter = fastJitter();

  if (state.mode === 'slave' && externalTimeSeconds !== undefined) {
    state.offset = (currentTimeSeconds - externalTimeSeconds) * 1000;
    state.locked = Math.abs(state.offset) < 2.0;
  } else if (state.mode === 'master') {
    state.locked = true;
    state.offset = 0;
  }

  state.lastSync = Date.now();
  return state;
}

/**
 * Allocating version for backward compat — creates new state object.
 */
export function updateSyncState(
  state: SMPTESyncState,
  currentTimeSeconds: number,
  externalTimeSeconds?: number,
): SMPTESyncState {
  const tc = secondsToTimecodeFast(currentTimeSeconds, state.frameRate, state.frameRate === 29.97);
  const jitter = fastJitter();

  let offset = state.offset;
  let locked = state.locked;

  if (state.mode === 'slave' && externalTimeSeconds !== undefined) {
    offset = (currentTimeSeconds - externalTimeSeconds) * 1000;
    locked = Math.abs(offset) < 2.0;
  } else if (state.mode === 'master') {
    locked = true;
    offset = 0;
  }

  return {
    ...state,
    timecode: { ...tc },
    offset,
    locked,
    jitter,
    lastSync: Date.now(),
  };
}

export function calculateDrift(elapsed: number, nominalFps: number, actualFps: number): number {
  return ((actualFps - nominalFps) / nominalFps) * 1e6;
}
