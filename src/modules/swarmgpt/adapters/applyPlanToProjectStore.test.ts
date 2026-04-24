import { describe, it, expect, vi } from 'vitest';
import { applyPlanToProjectStore } from './applyPlanToProjectStore';
import type { FormationPlan } from '../core/pipeline/planFormationFromAsset';

function fakePlan(): FormationPlan {
  return {
    formation: {
      points: [
        { x: -2, y: 0, z: -2 },
        { x: 2, y: 0, z: -2 },
        { x: 2, y: 0, z: 2 },
        { x: -2, y: 0, z: 2 },
      ],
    },
    transition: { fromCount: 0, toCount: 4, maxDistance: 0, avgDistance: 0 },
    validation: { valid: true, violations: [], maxSpeed: 0, maxDistance: 0 },
    fidelity: { score: 1, coverage: 1, dispersion: 0 },
    snappedTime: 1.5,
  } as unknown as FormationPlan;
}

describe('applyPlanToProjectStore', () => {
  it('adds + materializes a DroneFormation in the store', () => {
    const add = vi.fn();
    const mat = vi.fn();
    const recalc = vi.fn();
    const r = applyPlanToProjectStore(fakePlan(), {
      addDroneFormation: add,
      materializeFormation: mat,
      recalculateFormationTimings: recalc,
    });
    expect(add).toHaveBeenCalledTimes(1);
    expect(mat).toHaveBeenCalledTimes(1);
    expect(recalc).toHaveBeenCalledTimes(1);
    expect(r.droneCount).toBe(4);
    expect(r.formationId).toMatch(/^form-/);

    const formation = add.mock.calls[0][0];
    expect(formation.points).toHaveLength(4);
    expect(formation.startTime).toBe(1.5);
    expect(formation.radius).toBeCloseTo(2);
  });

  it('respects override options', () => {
    const add = vi.fn();
    const mat = vi.fn();
    applyPlanToProjectStore(fakePlan(), { addDroneFormation: add, materializeFormation: mat }, {
      startTime: 10,
      height: 80,
      color: '#ff00ff',
      transitionDuration: 6,
      holdDuration: 12,
    });
    const f = add.mock.calls[0][0];
    expect(f.startTime).toBe(10);
    expect(f.height).toBe(80);
    expect(f.color).toBe('#ff00ff');
    expect(f.transitionDuration).toBe(6);
    expect(f.holdDuration).toBe(12);
  });
});
