import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActiveGrid,
  snapTime,
  quantizeTime,
  stepTime,
  getSubdivisions,
} from '../timelineGrid';

vi.mock('@/core/time/timecodeProvider', () => ({
  timecodeProvider: { getFPS: () => 60 },
}));

describe('timelineGrid', () => {
  describe('getActiveGrid', () => {
    it('returns frame grid in auto mode when BPM is missing', () => {
      const g = getActiveGrid({ bpm: null, snapMode: 'auto' });
      expect(g.unit).toBe('frame');
      expect(g.interval).toBeCloseTo(1 / 60);
    });

    it('returns beat grid in auto mode when BPM is present', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'auto' });
      expect(g.unit).toBe('beat');
      expect(g.interval).toBeCloseTo(0.5);
    });

    it('forces frame grid when snapMode = frame even with BPM', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'frame', fps: 30 });
      expect(g.unit).toBe('frame');
      expect(g.interval).toBeCloseTo(1 / 30);
    });

    it('falls back to frame when snapMode = beat without BPM', () => {
      const g = getActiveGrid({ bpm: null, snapMode: 'beat' });
      expect(g.unit).toBe('frame');
    });

    it('disables snap in off mode', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'off' });
      expect(g.unit).toBe('none');
      expect(g.interval).toBe(0);
    });
  });

  describe('snapTime', () => {
    const beatGrid = getActiveGrid({ bpm: 120, snapMode: 'beat' }); // 0.5s

    it('snaps when within threshold', () => {
      // 0.49s with pps=100 → threshold = 0.08s, nearest = 0.5
      expect(snapTime(0.49, beatGrid, 100)).toBeCloseTo(0.5);
    });

    it('does not snap when outside threshold', () => {
      expect(snapTime(0.30, beatGrid, 100)).toBe(0.30);
    });

    it('snap window narrows as zoom increases', () => {
      // pps=400 → threshold = 0.02s
      expect(snapTime(0.46, beatGrid, 400)).toBe(0.46);
      expect(snapTime(0.49, beatGrid, 400)).toBeCloseTo(0.5);
    });

    it('does nothing when grid is off', () => {
      const off = getActiveGrid({ bpm: 120, snapMode: 'off' });
      expect(snapTime(0.49, off, 100)).toBe(0.49);
    });
  });

  describe('quantizeTime', () => {
    it('always quantizes regardless of distance', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'beat' });
      expect(quantizeTime(0.30, g)).toBeCloseTo(0.5);
      expect(quantizeTime(0.20, g)).toBeCloseTo(0);
    });
  });

  describe('stepTime', () => {
    it('moves exactly one unit', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'beat' });
      expect(stepTime(1.0, g, 1)).toBeCloseTo(1.5);
      expect(stepTime(1.0, g, -1)).toBeCloseTo(0.5);
    });

    it('clamps to zero', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'beat' });
      expect(stepTime(0.2, g, -1)).toBe(0);
    });
  });

  describe('getSubdivisions', () => {
    it('returns measure majors every 4 beats', () => {
      const g = getActiveGrid({ bpm: 120, snapMode: 'beat' }); // 0.5s
      const lines = getSubdivisions({
        grid: g, duration: 4, pixelsPerSecond: 50,
        scrollLeft: 0, viewportWidth: 200,
      });
      const majors = lines.filter(l => l.weight === 'major');
      // beats at 0, 0.5, 1.0, 1.5, 2.0 — measures at 0 and 2.0
      expect(majors.map(l => l.t)).toContain(0);
      expect(majors.map(l => l.t).some(t => Math.abs(t - 2) < 1e-6)).toBe(true);
    });

    it('falls back to per-second majors when frame grid is too dense', () => {
      const g = getActiveGrid({ bpm: null, snapMode: 'frame', fps: 60 }); // 1/60s
      // pps=10 → frame*pps = 0.166 px → not showing frames, just seconds
      const lines = getSubdivisions({
        grid: g, duration: 5, pixelsPerSecond: 10,
        scrollLeft: 0, viewportWidth: 60,
      });
      expect(lines.every(l => l.weight === 'major')).toBe(true);
    });

    it('shows individual frames when zoomed in', () => {
      const g = getActiveGrid({ bpm: null, snapMode: 'frame', fps: 30 }); // 1/30s
      // pps=400 → frame*pps = 13.3 px ≥ 12 → shows frames
      const lines = getSubdivisions({
        grid: g, duration: 1, pixelsPerSecond: 400,
        scrollLeft: 0, viewportWidth: 200,
      });
      expect(lines.length).toBeGreaterThan(10);
      expect(lines.some(l => l.weight === 'unit')).toBe(true);
    });
  });
});
