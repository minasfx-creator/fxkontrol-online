/**
 * Show Libertadores · golden seed validation (Phase 1).
 * Verifies structural targets, channel uniqueness per module within a
 * firing window, time monotonicity, and adapter routing alignment with
 * the 4×FXK16 hardware config.
 */
import { describe, it, expect } from 'vitest';
import {
  createLibertadoresShowPlan,
  summarizeLibertadores,
  LIBERTADORES_TARGETS,
} from '../libertadores';

const sp = createLibertadoresShowPlan();
const sum = summarizeLibertadores(sp);

describe('Libertadores · golden show structure', () => {
  it('hits the structural targets (32 low + 32 high + 8 comets)', () => {
    expect(sum.lowCount).toBeGreaterThanOrEqual(LIBERTADORES_TARGETS.POINTS_LOW);
    expect(sum.highCount).toBeGreaterThanOrEqual(LIBERTADORES_TARGETS.POINTS_HIGH);
    expect(sum.cometCount).toBe(LIBERTADORES_TARGETS.COMETS);
    expect(sum.duration).toBe(LIBERTADORES_TARGETS.DURATION_S);
  });

  it('uses 4 × FXK16 modules with 64 positions total', () => {
    expect(sum.modules).toBe(LIBERTADORES_TARGETS.MODULES);
    expect(sum.positions).toBe(LIBERTADORES_TARGETS.CHANNELS_TOTAL);
    for (const m of sp.hardwareConfig.modules) {
      expect(m.type).toBe('fxk16-esp32s3');
      expect(m.channelCount).toBe(16);
      expect(m.firmwareModel).toBe('FXK16');
    }
  });

  it('every cue references a known position', () => {
    const ids = new Set(sp.positions.map((p) => p.id));
    for (const c of sp.pyroCues) expect(ids.has(c.positionId)).toBe(true);
  });

  it('every cue routes to a valid module/channel within FXK16 range', () => {
    for (const c of sp.pyroCues) {
      expect(c.module).toBeGreaterThanOrEqual(0);
      expect(c.module).toBeLessThan(4);
      expect(c.channel).toBeGreaterThanOrEqual(0);
      expect(c.channel).toBeLessThan(16);
    }
  });

  it('cue times are monotonic when sorted and inside duration window', () => {
    const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].time).toBeGreaterThanOrEqual(sorted[i - 1].time);
    }
    expect(sorted[0].time).toBeGreaterThanOrEqual(0);
    expect(sorted[sorted.length - 1].time).toBeLessThanOrEqual(sp.metadata.duration);
  });

  it('no two cues share module+channel within a 1s window (safe re-fire)', () => {
    const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const dt = sorted[j].time - sorted[i].time;
        if (dt > 1.0) break;
        if (sorted[i].module === sorted[j].module && sorted[i].channel === sorted[j].channel) {
          throw new Error(
            `Channel reuse <1s on m${sorted[i].module}c${sorted[i].channel} ` +
              `at t=${sorted[i].time}s vs ${sorted[j].time}s`,
          );
        }
      }
    }
  });

  it('safety constraints are stadium-grade (dual-key + NFPA + 75mm cap)', () => {
    expect(sp.safetyConstraints.requireDualKey).toBe(true);
    expect(sp.safetyConstraints.requireContinuityCheck).toBe(true);
    expect(sp.safetyConstraints.nfpaMinDistance).toBeGreaterThanOrEqual(70);
    expect(sp.safetyConstraints.maxCaliper).toBe(75);
  });

  it('createLibertadoresShowPlan() is deterministic (no Math.random)', () => {
    const a = createLibertadoresShowPlan();
    const b = createLibertadoresShowPlan();
    // metadata.id is fixed; time arrays must match exactly
    expect(a.metadata.id).toBe(b.metadata.id);
    expect(a.pyroCues.map((c) => c.time)).toEqual(b.pyroCues.map((c) => c.time));
    expect(a.positions.map((p) => p.id)).toEqual(b.positions.map((p) => p.id));
  });
});
