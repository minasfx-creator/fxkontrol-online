/**
 * SwarmGPT Physics — Aggregate report builder.
 *
 * Combines kinematic + collision + bounds results into a single
 * `PhysicsReport` with merged metrics, capped issues, and a repair log.
 */
import {
  capIssues,
  DEFAULT_MAX_ISSUES,
  type PhysicalTrajectory,
  type PhysicsIssue,
  type PhysicsLimits,
  type PhysicsReport,
} from './types';
import { validateBounds, validateCollisions, validateKinematics } from './validators';

export interface BuildReportOptions {
  limits: PhysicsLimits;
  /** Maximum issues kept in the report. Default 200. */
  maxIssues?: number;
  /** Repair audit trail to embed (optional). */
  repairLog?: string[];
  /** Original (un-repaired) duration, for delta tracking. */
  originalDuration?: number;
}

export function buildPhysicsReport(
  traj: PhysicalTrajectory,
  options: BuildReportOptions,
): PhysicsReport {
  const max = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  const limits = options.limits;

  const k = validateKinematics(traj, limits, max);
  const c = validateCollisions(traj, limits.minSeparation, max);
  const b = limits.bounds ? validateBounds(traj, limits.bounds, max) : null;

  const merged: PhysicsIssue[] = [...k.issues, ...c.issues, ...(b?.issues ?? [])];
  const cap = capIssues(merged, max);
  const truncated = cap.truncated || k.truncated || c.truncated || (b?.truncated ?? false);

  const blockers = cap.issues.filter((i) => i.severity === 'blocker').length;
  const errors = cap.issues.filter((i) => i.severity === 'error').length;
  const ok = blockers === 0 && errors === 0 && c.metrics.collisionCount === 0;

  return {
    ok,
    issues: cap.issues,
    truncated,
    metrics: {
      droneCount: traj.dronePaths.length,
      sampleRate: traj.sampleRate,
      sampleCount: traj.times.length,
      duration: traj.duration,
      adjustedDuration: traj.duration - (options.originalDuration ?? traj.duration),
      maxSpeedUsed: k.metrics.maxSpeedUsed,
      maxAccelerationUsed: k.metrics.maxAccelerationUsed,
      maxJerkUsed: k.metrics.maxJerkUsed,
      minDistanceObserved: c.metrics.minDistanceObserved,
      collisionCount: c.metrics.collisionCount,
    },
    repairLog: options.repairLog ?? [],
  };
}
