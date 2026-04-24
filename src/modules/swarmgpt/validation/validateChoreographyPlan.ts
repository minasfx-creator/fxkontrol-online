/**
 * SwarmGPT 2.0 — Aggregate validator. Combines schema + timing + geometry +
 * referential integrity (transitions point to existing formations).
 */
import type {
  ChoreographyPlan,
  SwarmGPTInput,
  ValidationIssue,
  ValidationReport,
} from '../types';
import type { SwarmGPTConfig } from '../config';
import { ChoreographyPlanSchema } from '../schemas';
import { validateTiming } from './validateTiming';
import { validateGeometry } from './validateGeometry';

export function validateChoreographyPlan(
  plan: ChoreographyPlan,
  input: SwarmGPTInput,
  config: SwarmGPTConfig,
): ValidationReport {
  const issues: ValidationIssue[] = [];

  const schema = ChoreographyPlanSchema.safeParse(plan);
  if (!schema.success) {
    for (const issue of schema.error.issues) {
      issues.push({
        severity: 'error',
        code: 'SCHEMA_ERROR',
        message: issue.message,
        path: issue.path.join('.'),
      });
    }
    // If schema is broken, deeper checks would crash on bad shapes.
    return { ok: false, issues };
  }

  issues.push(...validateTiming(plan));
  issues.push(...validateGeometry(plan, input, config.minDroneDistance));

  const formationIds = new Set(plan.formations.map((f) => f.id));
  for (const [index, transition] of plan.transitions.entries()) {
    if (!formationIds.has(transition.fromFormationId)) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_FROM_FORMATION',
        message: `Transition ${transition.id} references unknown fromFormationId.`,
        path: `transitions.${index}.fromFormationId`,
      });
    }
    if (!formationIds.has(transition.toFormationId)) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_TO_FORMATION',
        message: `Transition ${transition.id} references unknown toFormationId.`,
        path: `transitions.${index}.toFormationId`,
      });
    }
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
