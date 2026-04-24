/**
 * SwarmGPT 2.0 — Deterministic geometry validator.
 * Checks point count, bounds containment and pairwise minimum distance.
 * Caps issue list at ~100 to keep payloads bounded.
 */
import type { ChoreographyPlan, SwarmGPTInput, ValidationIssue } from '../types';
import { distance3, isInsideBounds } from '../utils/geometry';

const MAX_DISTANCE_ISSUES = 100;

export function validateGeometry(
  plan: ChoreographyPlan,
  input: SwarmGPTInput,
  minDroneDistance: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [formationIndex, formation] of plan.formations.entries()) {
    if (formation.points.length !== input.droneCount) {
      issues.push({
        severity: 'error',
        code: 'INVALID_POINT_COUNT',
        message: `Formation ${formation.id} has ${formation.points.length} points, expected ${input.droneCount}.`,
        path: `formations.${formationIndex}.points`,
      });
    }

    for (const [pointIndex, point] of formation.points.entries()) {
      if (!isInsideBounds(point, input.bounds)) {
        issues.push({
          severity: 'error',
          code: 'POINT_OUT_OF_BOUNDS',
          message: `Point ${pointIndex} in formation ${formation.id} is outside bounds.`,
          path: `formations.${formationIndex}.points.${pointIndex}`,
        });
      }
    }

    let distanceIssues = 0;
    outer: for (let i = 0; i < formation.points.length; i++) {
      for (let j = i + 1; j < formation.points.length; j++) {
        const d = distance3(formation.points[i], formation.points[j]);
        if (d < minDroneDistance) {
          issues.push({
            severity: 'error',
            code: 'DRONES_TOO_CLOSE',
            message: `Points ${i} and ${j} in formation ${formation.id} are too close: ${d.toFixed(2)}m.`,
            path: `formations.${formationIndex}.points`,
          });
          distanceIssues++;
          if (distanceIssues >= MAX_DISTANCE_ISSUES) {
            issues.push({
              severity: 'warning',
              code: 'TOO_MANY_DISTANCE_ISSUES',
              message: `Distance validation stopped after ${MAX_DISTANCE_ISSUES} issues in formation ${formation.id}.`,
            });
            break outer;
          }
        }
      }
    }
  }

  return issues;
}
