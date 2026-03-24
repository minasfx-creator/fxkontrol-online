/**
 * SMPTE Timecode Core — zero-allocation math & formatting
 * Extracted from smpteEngine.ts for modularity & performance.
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

// ── Pre-allocated reusable timecode object (zero-GC hot path) ──
const _tcScratch: SMPTETimecode = {
  hours: 0, minutes: 0, seconds: 0, frames: 0,
  dropFrame: false, frameRate: 30,
};

/**
 * Convert seconds to timecode — returns a SHARED scratch object.
 * Caller must copy if persisting; this avoids GC on hot tick loops.
 */
export function secondsToTimecodeFast(totalSeconds: number, fps: SMPTEFrameRate, dropFrame = false): SMPTETimecode {
  let totalFrames = Math.floor(totalSeconds * fps);

  if (dropFrame && fps === 29.97) {
    const D = 2;
    const M = 17982;
    const d = Math.floor(totalFrames / M);
    const m = totalFrames % M;
    totalFrames += 9 * D * d;
    if (m > D) {
      totalFrames += D * Math.floor((m - D) / (M / 10 - D));
    }
  }

  const effectiveFps = fps === 29.97 ? 30 : fps;
  _tcScratch.frames = totalFrames % effectiveFps;
  _tcScratch.seconds = Math.floor(totalFrames / effectiveFps) % 60;
  _tcScratch.minutes = Math.floor(totalFrames / (effectiveFps * 60)) % 60;
  _tcScratch.hours = Math.floor(totalFrames / (effectiveFps * 3600)) % 24;
  _tcScratch.dropFrame = dropFrame;
  _tcScratch.frameRate = fps;

  return _tcScratch;
}

/** Allocating version — safe to store. */
export function secondsToTimecode(totalSeconds: number, fps: SMPTEFrameRate, dropFrame = false): SMPTETimecode {
  const fast = secondsToTimecodeFast(totalSeconds, fps, dropFrame);
  return { ...fast };
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

// ── Pre-allocated string buffer for zero-alloc formatting ──
const _fmtBuf = new Uint8Array(11); // "HH:MM:SS:FF" or "HH:MM:SS;FF"
const CHAR_0 = 48; // '0'
const CHAR_COLON = 58; // ':'
const CHAR_SEMI = 59; // ';'

export function formatTimecode(tc: SMPTETimecode): string {
  _fmtBuf[0] = CHAR_0 + Math.floor(tc.hours / 10);
  _fmtBuf[1] = CHAR_0 + (tc.hours % 10);
  _fmtBuf[2] = CHAR_COLON;
  _fmtBuf[3] = CHAR_0 + Math.floor(tc.minutes / 10);
  _fmtBuf[4] = CHAR_0 + (tc.minutes % 10);
  _fmtBuf[5] = CHAR_COLON;
  _fmtBuf[6] = CHAR_0 + Math.floor(tc.seconds / 10);
  _fmtBuf[7] = CHAR_0 + (tc.seconds % 10);
  _fmtBuf[8] = tc.dropFrame ? CHAR_SEMI : CHAR_COLON;
  _fmtBuf[9] = CHAR_0 + Math.floor(tc.frames / 10);
  _fmtBuf[10] = CHAR_0 + (tc.frames % 10);

  return String.fromCharCode(
    _fmtBuf[0], _fmtBuf[1], _fmtBuf[2],
    _fmtBuf[3], _fmtBuf[4], _fmtBuf[5],
    _fmtBuf[6], _fmtBuf[7], _fmtBuf[8],
    _fmtBuf[9], _fmtBuf[10]
  );
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

/** Copy a timecode into a target object (zero allocation). */
export function copyTimecode(src: SMPTETimecode, dst: SMPTETimecode): void {
  dst.hours = src.hours;
  dst.minutes = src.minutes;
  dst.seconds = src.seconds;
  dst.frames = src.frames;
  dst.dropFrame = src.dropFrame;
  dst.frameRate = src.frameRate;
}
