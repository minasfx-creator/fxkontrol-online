/**
 * ─── Frame Time Service ─────────────────────────────────────────────
 * Aligns global time to exact frame boundaries.
 * Ensures all execution happens "locked" to frames — no loose time.
 */

import { timecodeProvider } from './timecodeProvider';

export interface FrameTimeState {
  frameAlignedMs: number;
  currentFrame: number;
  fps: number;
  frameDurationMs: number;
  subFrameOffsetMs: number;  // how far into the current frame we are
}

class FrameTimeService {
  /**
   * Get time snapped to the nearest frame boundary.
   * This is the canonical "when does this frame start?" value.
   */
  getFrameAlignedTime(): number {
    return timecodeProvider.getFrameAlignedTime();
  }

  /**
   * Get the current frame number.
   */
  getCurrentFrame(): number {
    return timecodeProvider.getFrame();
  }

  /**
   * Align any arbitrary time (ms) to its frame boundary.
   */
  alignToFrame(timeMs: number): number {
    const fd = timecodeProvider.getFrameDuration();
    return Math.round(timeMs / fd) * fd;
  }

  /**
   * Get sub-frame alpha (0..1) — useful for interpolation.
   * 0 = start of frame, 1 = end of frame.
   */
  getSubFrameAlpha(): number {
    const tc = timecodeProvider.getTimecode();
    const fd = timecodeProvider.getFrameDuration();
    return (tc % fd) / fd;
  }

  /**
   * Convert seconds (timeline time) to frame-aligned milliseconds.
   */
  secondsToFrameMs(seconds: number): number {
    const ms = seconds * 1000;
    const fd = timecodeProvider.getFrameDuration();
    return Math.round(ms / fd) * fd;
  }

  /**
   * Get frame number for a given time in seconds.
   */
  secondsToFrame(seconds: number): number {
    return Math.floor((seconds * 1000) / timecodeProvider.getFrameDuration());
  }

  /**
   * Full state snapshot.
   */
  getState(): FrameTimeState {
    const tc = timecodeProvider.getTimecode();
    const fd = timecodeProvider.getFrameDuration();
    const frame = Math.floor(tc / fd);
    const aligned = frame * fd;

    return {
      frameAlignedMs: aligned,
      currentFrame: frame,
      fps: timecodeProvider.getFPS(),
      frameDurationMs: fd,
      subFrameOffsetMs: tc - aligned,
    };
  }
}

export const frameTimeService = new FrameTimeService();
