/**
 * LTC Encoder — Pre-allocated buffers for zero-GC audio generation.
 * Encodes SMPTE 12M timecode to LTC biphase-mark audio.
 */

import { type SMPTETimecode } from './timecodeCore';

export interface LTCSignal {
  bits: number[];
  biphase: number[];
  audioSamples: Float32Array;
}

// ── Pre-allocated buffers (reused every frame) ──
const _ltcBits = new Array(80).fill(0);
const _syncWord = [0,0,1,1, 1,1,1,1, 1,1,1,1, 1,1,0,1];
const _biphaseBuffer: number[] = new Array(160); // 80 bits × 2
// Audio buffer sized for 30fps at 48kHz: ceil(48000/30/80) × 160 = ~3200 samples
const MAX_AUDIO_SAMPLES = 4000;
const _audioBuffer = new Float32Array(MAX_AUDIO_SAMPLES);

function setBCD(bits: number[], offset: number, value: number, numBits: number) {
  for (let i = 0; i < numBits; i++) {
    bits[offset + i] = (value >> i) & 1;
  }
}

/**
 * Encode timecode to LTC. Returns references to SHARED buffers.
 * Caller must consume immediately; next call overwrites.
 */
export function encodeTimecodeToLTC(tc: SMPTETimecode): LTCSignal {
  // Reset bits
  for (let i = 0; i < 80; i++) _ltcBits[i] = 0;

  // BCD encode
  setBCD(_ltcBits, 0, tc.frames % 10, 4);
  setBCD(_ltcBits, 8, Math.floor(tc.frames / 10), 2);
  setBCD(_ltcBits, 16, tc.seconds % 10, 4);
  setBCD(_ltcBits, 24, Math.floor(tc.seconds / 10), 3);
  setBCD(_ltcBits, 32, tc.minutes % 10, 4);
  setBCD(_ltcBits, 40, Math.floor(tc.minutes / 10), 3);
  setBCD(_ltcBits, 48, tc.hours % 10, 4);
  setBCD(_ltcBits, 56, Math.floor(tc.hours / 10), 2);

  if (tc.dropFrame) _ltcBits[10] = 1;

  // Sync word
  for (let i = 0; i < 16; i++) _ltcBits[64 + i] = _syncWord[i];

  // Biphase-mark encoding
  let lastLevel = 1;
  let bIdx = 0;
  for (let i = 0; i < 80; i++) {
    lastLevel = lastLevel === 1 ? 0 : 1;
    _biphaseBuffer[bIdx++] = lastLevel;
    if (_ltcBits[i] === 1) {
      lastLevel = lastLevel === 1 ? 0 : 1;
    }
    _biphaseBuffer[bIdx++] = lastLevel;
  }

  // Audio samples at 48kHz
  const effectiveFps = tc.frameRate === 29.97 ? 30 : tc.frameRate;
  const samplesPerBit = Math.floor(48000 / effectiveFps / 80);
  const totalSamples = Math.min(bIdx * samplesPerBit, MAX_AUDIO_SAMPLES);

  for (let i = 0; i < bIdx; i++) {
    const val = _biphaseBuffer[i] === 1 ? 0.8 : -0.8;
    const base = i * samplesPerBit;
    for (let s = 0; s < samplesPerBit && base + s < MAX_AUDIO_SAMPLES; s++) {
      _audioBuffer[base + s] = val;
    }
  }

  return {
    bits: _ltcBits,
    biphase: _biphaseBuffer,
    audioSamples: _audioBuffer.subarray(0, totalSamples),
  };
}

/** MTC Quarter-Frame messages */
export interface MTCQuarterFrame {
  piece: number;
  nibble: number;
}

// Pre-allocated array of 8 quarter-frame objects
const _mtcFrames: MTCQuarterFrame[] = Array.from({ length: 8 }, (_, i) => ({ piece: i, nibble: 0 }));

export function generateMTCQuarterFrames(tc: SMPTETimecode): MTCQuarterFrame[] {
  const rateFlag = tc.frameRate === 24 ? 0 : tc.frameRate === 25 ? 1 : tc.frameRate === 29.97 ? 2 : 3;
  _mtcFrames[0].nibble = tc.frames & 0x0F;
  _mtcFrames[1].nibble = (tc.frames >> 4) & 0x01;
  _mtcFrames[2].nibble = tc.seconds & 0x0F;
  _mtcFrames[3].nibble = (tc.seconds >> 4) & 0x03;
  _mtcFrames[4].nibble = tc.minutes & 0x0F;
  _mtcFrames[5].nibble = (tc.minutes >> 4) & 0x03;
  _mtcFrames[6].nibble = tc.hours & 0x0F;
  _mtcFrames[7].nibble = ((tc.hours >> 4) & 0x01) | (rateFlag << 1);
  return _mtcFrames;
}
