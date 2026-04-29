/**
 * Guardian tests — transitionPlanner collision detection.
 *
 * Covers M4: previously the planner hard-coded `collisionFree: true`.
 * Now it runs a swept-pair check against `config.collisionRadius`.
 */
import { describe, it, expect } from 'vitest';
import {
  planTransition,
  DEFAULT_TRANSITION_CONFIG,
  type TransitionSlot,
} from '@/lib/transitionPlanner';

function slot(id: string, x: number, y: number, z: number): TransitionSlot {
  return { id, x, y, z };
}

describe('transitionPlanner collision detection', () => {
  it('flags clearly separated parallel paths as collisionFree', () => {
    const source = [slot('a', 0, 10, 0), slot('b', 0, 10, 50)];
    const target = [slot('A', 100, 10, 0), slot('B', 100, 10, 50)];
    const plan = planTransition(source, target, {
      ...DEFAULT_TRANSITION_CONFIG,
      staggerMode: 'none',
      staggerDelay: 0,
      collisionRadius: 2,
    });
    expect(plan.collisionFree).toBe(true);
  });

  it('flags two drones swapping positions as NOT collisionFree', () => {
    // Crossing trajectories at identical altitude — they meet in the middle.
    const source = [slot('a', 0, 10, 0), slot('b', 100, 10, 0)];
    const target = [slot('A', 100, 10, 0), slot('B', 0, 10, 0)];
    const plan = planTransition(source, target, {
      ...DEFAULT_TRANSITION_CONFIG,
      staggerMode: 'none',
      staggerDelay: 0,
      collisionRadius: 2,
    });
    expect(plan.collisionFree).toBe(false);
  });

  it('returns collisionFree=true for trivial single-drone plan', () => {
    const plan = planTransition(
      [slot('a', 0, 10, 0)],
      [slot('A', 5, 10, 0)],
      DEFAULT_TRANSITION_CONFIG,
    );
    expect(plan.collisionFree).toBe(true);
  });
});
