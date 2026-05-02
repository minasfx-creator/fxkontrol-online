import { describe, it, expect } from 'vitest';
import { sanitizeShowPlan, sanitizationToText } from '../sanitizeShowPlan';
import { createEmptyShowPlan } from '../ShowPlan';
import type { ShowPlan } from '../ShowPlan';

function planWith(overrides: Partial<ShowPlan>): ShowPlan {
  return { ...createEmptyShowPlan(), ...overrides };
}

describe('sanitizeShowPlan', () => {
  it('returns unchanged result when ShowPlan is clean', () => {
    const sp = planWith({
      metadata: { ...createEmptyShowPlan().metadata, name: 'My Show', duration: 30 },
      positions: [{ id: 'p1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0 }],
      pyroCues: [{
        id: 'c1', time: 1, positionId: 'p1', module: 0, channel: 0,
        effectId: 'fx', fuseDelay: 0, caliber: 75, elevation: 90, heading: 0,
        position: { x: 0, y: 0, z: 0 },
      }],
    });
    const r = sanitizeShowPlan(sp);
    expect(r.changed).toBe(false);
    expect(r.plan).toBe(sp);
  });

  it('removes orphan pyro cues without touching valid ones', () => {
    const sp = planWith({
      metadata: { ...createEmptyShowPlan().metadata, name: 'X', duration: 10 },
      positions: [{ id: 'p1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0 }],
      pyroCues: [
        { id: 'good', time: 1, positionId: 'p1', module: 0, channel: 0, effectId: 'fx', fuseDelay: 0, caliber: 75, elevation: 90, heading: 0, position: { x: 0, y: 0, z: 0 } },
        { id: 'orphan', time: 2, positionId: 'ghost', module: 0, channel: 1, effectId: 'fx', fuseDelay: 0, caliber: 75, elevation: 90, heading: 0, position: { x: 0, y: 0, z: 0 } },
      ],
    });
    const r = sanitizeShowPlan(sp);
    expect(r.changed).toBe(true);
    expect(r.diff.removedPyroCueIds).toEqual(['orphan']);
    expect(r.plan.pyroCues.map((c) => c.id)).toEqual(['good']);
    expect(sp.pyroCues.length).toBe(2); // input untouched
  });

  it('fills blank name and zero duration deterministically', () => {
    const sp = planWith({
      metadata: { ...createEmptyShowPlan().metadata, name: '', venue: 'Maracanã', duration: 0 },
      positions: [{ id: 'p1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0 }],
      pyroCues: [{ id: 'c1', time: 5.5, positionId: 'p1', module: 0, channel: 0, effectId: 'fx', fuseDelay: 0, caliber: 75, elevation: 90, heading: 0, position: { x: 0, y: 0, z: 0 } }],
    });
    const r = sanitizeShowPlan(sp);
    expect(r.diff.filledName).toBe('Maracanã — Show');
    expect(r.diff.filledDuration).toBe(5.5);
    expect(r.plan.metadata.name).toBe('Maracanã — Show');
    expect(r.plan.metadata.duration).toBe(5.5);
  });

  it('is deterministic and pure (no clocks, no random)', () => {
    const sp = planWith({
      positions: [{ id: 'p1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0 }],
      pyroCues: [{ id: 'orphan', time: 1, positionId: 'ghost', module: 0, channel: 0, effectId: 'fx', fuseDelay: 0, caliber: 75, elevation: 90, heading: 0, position: { x: 0, y: 0, z: 0 } }],
    });
    const a = sanitizeShowPlan(sp);
    const b = sanitizeShowPlan(sp);
    expect(a.diff).toEqual(b.diff);
    expect(a.plan.pyroCues).toEqual(b.plan.pyroCues);
  });

  it('text summary covers all diff dimensions', () => {
    const txt = sanitizationToText({
      removedPyroCueIds: ['a', 'b'],
      removedDronePathIds: ['d1'],
      filledName: 'X',
      filledDuration: 12.34,
    });
    expect(txt).toContain('2 orphan pyro cue');
    expect(txt).toContain('1 orphan drone path');
    expect(txt).toContain('"X"');
    expect(txt).toContain('12.34s');
    expect(sanitizationToText({ removedPyroCueIds: [], removedDronePathIds: [], filledName: null, filledDuration: null })).toBe('No changes — ShowPlan already clean.');
  });
});
