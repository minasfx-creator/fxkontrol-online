/**
 * SwarmGPT 2.0 — Deterministic timing validator.
 * Checks formations and transitions fit inside the show duration.
 */
import type { ChoreographyPlan, ValidationIssue } from '../types';

export function validateTiming(plan: ChoreographyPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (plan.duration <= 0) {
    issues.push({
      severity: 'error',
      code: 'INVALID_DURATION',
      message: 'Show duration must be greater than zero.',
      path: 'duration',
    });
  }

  for (const [index, formation] of plan.formations.entries()) {
    if (formation.startTime < 0) {
      issues.push({
        severity: 'error',
        code: 'FORMATION_START_NEGATIVE',
        message: `Formation ${formation.id} starts before zero.`,
        path: `formations.${index}.startTime`,
      });
    }
    if (formation.duration <= 0) {
      issues.push({
        severity: 'error',
        code: 'FORMATION_DURATION_INVALID',
        message: `Formation ${formation.id} has invalid duration.`,
        path: `formations.${index}.duration`,
      });
    }
    if (formation.startTime + formation.duration > plan.duration) {
      issues.push({
        severity: 'error',
        code: 'FORMATION_EXCEEDS_DURATION',
        message: `Formation ${formation.id} exceeds show duration.`,
        path: `formations.${index}`,
      });
    }
  }

  for (const [index, transition] of plan.transitions.entries()) {
    if (transition.startTime < 0) {
      issues.push({
        severity: 'error',
        code: 'TRANSITION_START_NEGATIVE',
        message: `Transition ${transition.id} starts before zero.`,
        path: `transitions.${index}.startTime`,
      });
    }
    if (transition.duration <= 0) {
      issues.push({
        severity: 'error',
        code: 'TRANSITION_DURATION_INVALID',
        message: `Transition ${transition.id} has invalid duration.`,
        path: `transitions.${index}.duration`,
      });
    }
    if (transition.startTime + transition.duration > plan.duration) {
      issues.push({
        severity: 'error',
        code: 'TRANSITION_EXCEEDS_DURATION',
        message: `Transition ${transition.id} exceeds show duration.`,
        path: `transitions.${index}`,
      });
    }
  }

  return issues;
}
