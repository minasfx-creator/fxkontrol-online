/**
 * SwarmGPT 2.0 — Compiler. Turns a validated plan into ordered TimelineCues.
 * Pure function, deterministic. No runtime mutation.
 */
import type { ChoreographyPlan, TimelineCue } from '../types';

export function compilePlanToTimeline(plan: ChoreographyPlan): TimelineCue[] {
  const formationCues: TimelineCue[] = plan.formations.map((formation) => ({
    id: `cue_${formation.id}`,
    type: 'drone_formation',
    startTime: formation.startTime,
    duration: formation.duration,
    payload: {
      formationId: formation.id,
      name: formation.name,
      shape: formation.shape,
      points: formation.points,
      color: formation.color,
      description: formation.description,
    },
  }));

  const transitionCues: TimelineCue[] = plan.transitions.map((transition) => ({
    id: `cue_${transition.id}`,
    type: 'drone_transition',
    startTime: transition.startTime,
    duration: transition.duration,
    payload: {
      fromFormationId: transition.fromFormationId,
      toFormationId: transition.toFormationId,
      transitionType: transition.type,
    },
  }));

  return [...formationCues, ...transitionCues].sort((a, b) => a.startTime - b.startTime);
}
