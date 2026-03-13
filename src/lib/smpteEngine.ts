/**
 * SMPTE / LTC Timecode Engine
 * Generates, parses, and syncs SMPTE timecode (24/25/29.97df/30 fps).
 * Supports LTC (Linear Timecode) audio-level encoding/decoding simulation.
 */

export type SMPTEFrameRate = 24 | 25 | 29.97 | 30;

export interface SMPTETimecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  dropFrame: boolean;
  frameRate: SMPTEFrameRate;
}

export interface LTCSignal {
  bits: number[];        // 80-bit LTC word
  biphase: number[];     // Manchester-encoded signal
  audioSamples: Float32Array; // PCM audio at 48kHz
}

export interface SMPTESyncState {
  mode: 'master' | 'slave' | 'freerun';
  locked: boolean;
  offset: number;        // ms offset from external source
  drift: number;         // ppm drift rate
  lastSync: number;      // timestamp of last sync
  jitter: number;        // ms jitter measurement
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

/* ── Timecode math ───────────────────────────────── */

export function secondsToTimecode(totalSeconds: number, fps: SMPTEFrameRate, dropFrame = false): SMPTETimecode {
  let totalFrames = Math.floor(totalSeconds * fps);

  if (dropFrame && fps === 29.97) {
    // Drop-frame: skip frames 0 and 1 at start of each minute, except every 10th minute
    const D = 2;
    const M = 17982; // frames per 10 min in 29.97df
    const d = Math.floor(totalFrames / M);
    const m = totalFrames % M;
    totalFrames += 9 * D * d;
    if (m > D) {
      totalFrames += D * Math.floor((m - D) / (M / 10 - D));
    }
  }

  const effectiveFps = fps === 29.97 ? 30 : fps;
  const frames = totalFrames % effectiveFps;
  const seconds = Math.floor(totalFrames / effectiveFps) % 60;
  const minutes = Math.floor(totalFrames / (effectiveFps * 60)) % 60;
  const hours = Math.floor(totalFrames / (effectiveFps * 3600)) % 24;

  return { hours, minutes, seconds, frames, dropFrame, frameRate: fps };
}

export function timecodeToSeconds(tc: SMPTETimecode): number {
  const effectiveFps = tc.frameRate === 29.97 ? 30 : tc.frameRate;
  let totalFrames = tc.hours * 3600 * effectiveFps
    + tc.minutes * 60 * effectiveFps
    + tc.seconds * effectiveFps
    + tc.frames;

  if (tc.dropFrame && tc.frameRate === 29.97) {
    const totalMinutes = tc.hours * 60 + tc.minutes;
    totalFrames -= 2 * (totalMinutes - Math.floor(totalMinutes / 10));
  }

  return totalFrames / (tc.frameRate === 29.97 ? 29.97 : tc.frameRate);
}

export function formatTimecode(tc: SMPTETimecode): string {
  const sep = tc.dropFrame ? ';' : ':';
  return `${pad2(tc.hours)}:${pad2(tc.minutes)}:${pad2(tc.seconds)}${sep}${pad2(tc.frames)}`;
}

export function parseTimecode(str: string, fps: SMPTEFrameRate): SMPTETimecode | null {
  const df = str.includes(';');
  const parts = str.replace(/;/g, ':').split(':').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return {
    hours: parts[0], minutes: parts[1], seconds: parts[2], frames: parts[3],
    dropFrame: df, frameRate: fps,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/* ── LTC Encoding (simplified) ───────────────────── */

export function encodeTimecodeToLTC(tc: SMPTETimecode): LTCSignal {
  // Build 80-bit LTC word per SMPTE 12M
  const bits: number[] = new Array(80).fill(0);

  // Frames (units: bits 0-3, tens: bits 8-9)
  setBCD(bits, 0, tc.frames % 10, 4);
  setBCD(bits, 8, Math.floor(tc.frames / 10), 2);

  // Seconds (units: bits 16-19, tens: bits 24-26)
  setBCD(bits, 16, tc.seconds % 10, 4);
  setBCD(bits, 24, Math.floor(tc.seconds / 10), 3);

  // Minutes (units: bits 32-35, tens: bits 40-42)
  setBCD(bits, 32, tc.minutes % 10, 4);
  setBCD(bits, 40, Math.floor(tc.minutes / 10), 3);

  // Hours (units: bits 48-51, tens: bits 56-57)
  setBCD(bits, 48, tc.hours % 10, 4);
  setBCD(bits, 56, Math.floor(tc.hours / 10), 2);

  // Drop-frame flag (bit 10)
  if (tc.dropFrame) bits[10] = 1;

  // Sync word (bits 64-79): fixed pattern 0011 1111 1111 1101
  const sync = [0,0,1,1, 1,1,1,1, 1,1,1,1, 1,1,0,1];
  for (let i = 0; i < 16; i++) bits[64 + i] = sync[i];

  // Manchester / biphase-mark encoding
  const biphase: number[] = [];
  let lastLevel = 1;
  for (const bit of bits) {
    // Transition at start of every bit
    lastLevel = lastLevel === 1 ? 0 : 1;
    biphase.push(lastLevel);
    // Additional transition in middle if bit = 1
    if (bit === 1) {
      lastLevel = lastLevel === 1 ? 0 : 1;
    }
    biphase.push(lastLevel);
  }

  // Generate audio samples at 48kHz
  const samplesPerBit = Math.floor(48000 / (tc.frameRate === 29.97 ? 30 : tc.frameRate) / 80);
  const audioSamples = new Float32Array(biphase.length * samplesPerBit);
  for (let i = 0; i < biphase.length; i++) {
    const val = biphase[i] === 1 ? 0.8 : -0.8;
    for (let s = 0; s < samplesPerBit; s++) {
      audioSamples[i * samplesPerBit + s] = val;
    }
  }

  return { bits, biphase, audioSamples };
}

function setBCD(bits: number[], offset: number, value: number, numBits: number) {
  for (let i = 0; i < numBits; i++) {
    bits[offset + i] = (value >> i) & 1;
  }
}

/* ── Sync simulation ────────────────────────────── */

export function simulateSyncJitter(): number {
  // Gaussian-ish jitter, ±0.5ms typical
  return (Math.random() - 0.5) * 1.0;
}

export function calculateDrift(elapsed: number, nominalFps: number, actualFps: number): number {
  // ppm drift
  return ((actualFps - nominalFps) / nominalFps) * 1e6;
}

export function updateSyncState(
  state: SMPTESyncState,
  currentTimeSeconds: number,
  externalTimeSeconds?: number,
): SMPTESyncState {
  const tc = secondsToTimecode(currentTimeSeconds, state.frameRate, state.frameRate === 29.97);
  const jitter = simulateSyncJitter();

  let offset = state.offset;
  let locked = state.locked;

  if (state.mode === 'slave' && externalTimeSeconds !== undefined) {
    offset = (currentTimeSeconds - externalTimeSeconds) * 1000; // ms
    locked = Math.abs(offset) < 2.0; // locked if within 2ms
  } else if (state.mode === 'master') {
    locked = true;
    offset = 0;
  }

  return {
    ...state,
    timecode: tc,
    offset,
    locked,
    jitter,
    lastSync: Date.now(),
  };
}

/* ── MTC (MIDI Timecode) quarter-frame messages ── */

export interface MTCQuarterFrame {
  piece: number; // 0-7
  nibble: number;
}

export function generateMTCQuarterFrames(tc: SMPTETimecode): MTCQuarterFrame[] {
  const rateFlag = tc.frameRate === 24 ? 0 : tc.frameRate === 25 ? 1 : tc.frameRate === 29.97 ? 2 : 3;
  return [
    { piece: 0, nibble: tc.frames & 0x0F },
    { piece: 1, nibble: (tc.frames >> 4) & 0x01 },
    { piece: 2, nibble: tc.seconds & 0x0F },
    { piece: 3, nibble: (tc.seconds >> 4) & 0x03 },
    { piece: 4, nibble: tc.minutes & 0x0F },
    { piece: 5, nibble: (tc.minutes >> 4) & 0x03 },
    { piece: 6, nibble: tc.hours & 0x0F },
    { piece: 7, nibble: ((tc.hours >> 4) & 0x01) | (rateFlag << 1) },
  ];
}
