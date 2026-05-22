/**
 * Fatia 8 #5 — FrameSyncEngine drift clamp + accumulator ceiling.
 *
 * Guarantees a glitchy timecode source cannot poison the integrator beyond the
 * documented bounds (200ms per tick, ±5s lifetime).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/core/time/timecodeProvider', () => {
  let frameAligned = 0;
  return {
    timecodeProvider: {
      getFrameAlignedTime: () => frameAligned,
      getFrameDuration: () => 1000 / 30, // 30fps
      isLocked: () => true,
      getState: () => ({ fps: 30, frame: 0, source: 'ltc' }),
      __setFrameAligned: (v: number) => { frameAligned = v; },
    },
  };
});
vi.mock('@/core/time/frameTimeService', () => ({ frameTimeService: {} }));

import { frameSyncEngine } from '../frameSyncEngine';
import { timecodeProvider } from '@/core/time/timecodeProvider';

const setTC = (v: number) =>
  (timecodeProvider as unknown as { __setFrameAligned: (n: number) => void })
    .__setFrameAligned(v);

describe('Fatia 8 #5 — FrameSync drift clamp', () => {
  beforeEach(() => {
    frameSyncEngine.reset();
  });

  it('a single 1000ms glitch does not advance accumulator beyond per-tick budget', () => {
    setTC(1000);                       // raw error = +1000ms
    frameSyncEngine.getSyncedTime(0);
    // raw clamped to 200ms, then * 0.2 = 40ms accumulated max in one tick.
    const stateAfter = frameSyncEngine.getState();
    expect(Math.abs(stateAfter.correctionMs)).toBeLessThanOrEqual(40 + 0.001);
  });

  it('100 ticks of +1000ms drift never push accumulator beyond ±5000ms', () => {
    setTC(1000);
    for (let i = 0; i < 100; i++) {
      frameSyncEngine.getSyncedTime(0);
    }
    const acc = frameSyncEngine.getState().correctionMs;
    expect(acc).toBeLessThanOrEqual(5000);
    expect(acc).toBeGreaterThanOrEqual(-5000);
  });

  it('status reflects RAW drift (UI must see the glitch even when integrator is clamped)', () => {
    setTC(500); // way above DRIFT_WARN_MS
    frameSyncEngine.getSyncedTime(0);
    expect(frameSyncEngine.getStatus()).toBe('drifting');
  });

  it('reset() clears accumulator (timeline seek path)', () => {
    setTC(1000);
    frameSyncEngine.getSyncedTime(0);
    expect(frameSyncEngine.getState().correctionMs).not.toBe(0);
    frameSyncEngine.reset();
    expect(frameSyncEngine.getState().correctionMs).toBe(0);
  });
});
