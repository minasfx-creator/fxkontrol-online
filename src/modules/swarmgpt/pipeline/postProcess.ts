/**
 * SwarmGPT — Deterministic post-processing applied after the repair loop
 * succeeds and before compilation.
 *   1. Poisson resample each formation to enforce min distance.
 *   2. (Optional) Beat-snap formation/transition start times when bpm > 0.
 *   3. Greedy reorder of `to.points` to minimize travel during transitions.
 *   4. Stable sort by startTime so collisions surface in validation.
 *
 * Pure: returns a new plan. Never mutates the input.
 */
import type {
  ChoreographyPlan,
  DroneTransition,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPTConfig } from '../config';
import {
  buildBeatGrid,
  generateOptimizedFormation,
  optimizeTransition,
  snapToBeat,
} from '../advanced';

export function applyAdvancedPostProcessing(
  plan: ChoreographyPlan,
  input: SwarmGPTInput,
  config: SwarmGPTConfig,
): ChoreographyPlan {
  // 1) Geometry pass — Poisson resample each formation.
  let next: ChoreographyPlan = {
    ...plan,
    formations: plan.formations.map((f) => ({
      ...f,
      points: generateOptimizedFormation(f.points, input.droneCount, config.minDroneDistance),
    })),
  };

  // 2) Optional beat snap.
  if (input.bpm && input.bpm > 0) {
    const beats = buildBeatGrid(input.bpm, input.duration);
    if (beats.length > 0) {
      next = {
        ...next,
        formations: next.formations.map((f) => ({
          ...f,
          startTime: snapToBeat(f.startTime, beats),
        })),
        transitions: next.transitions.map((t) => ({
          ...t,
          startTime: snapToBeat(t.startTime, beats),
        })),
      };
    }
  }

  // 3) Transition matching pass — pre-index incoming transitions O(F+T).
  const formationById = new Map(next.formations.map((f) => [f.id, f]));
  const transitionByTo = new Map<string, DroneTransition>();
  for (const t of next.transitions) transitionByTo.set(t.toFormationId, t);

  next = {
    ...next,
    formations: next.formations.map((f) => {
      const incoming = transitionByTo.get(f.id);
      if (!incoming) return f;
      const fromF = formationById.get(incoming.fromFormationId);
      if (!fromF) return f;
      return {
        ...f,
        points: optimizeTransition(
          fromF.points,
          f.points,
          incoming.duration,
          config.maxDroneSpeed,
        ),
      };
    }),
  };

  // 4) Stable sort by startTime — surfaces overlaps in validation.
  next = {
    ...next,
    formations: [...next.formations].sort((a, b) => a.startTime - b.startTime),
    transitions: [...next.transitions].sort((a, b) => a.startTime - b.startTime),
  };

  return next;
}
