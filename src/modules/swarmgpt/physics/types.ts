/**
 * SwarmGPT Physics — Shared types.
 *
 * Pure domain types for the physics module. No React, no Three.js, no
 * hardware. The physics layer is conceptually downstream of formation
 * generation and upstream of timeline compilation:
 *
 *   from/to formations
 *     → matchPointsByCost
 *     → compilePhysicalTrajectory (caller-provided easing)
 *     → validateKinematics + validateCollisions + validateBounds
 *     → repairPhysicalTransition (if needed)
 *     → physicsReport (always)
 */
import type { Vec3, Bounds } from '../types';

export type MotionStyle = 'cinematic' | 'fast' | 'soft' | 'snap' | 'organic';

export type PhysicsSeverity = 'warning' | 'error' | 'blocker';
export type PhysicsIssueKind =
  | 'speed'
  | 'acceleration'
  | 'jerk'
  | 'collision'
  | 'bounds'
  | 'matching'
  | 'repair';

export interface PhysicsIssue {
  kind: PhysicsIssueKind;
  severity: PhysicsSeverity;
  message: string;
  /** Drone index, or `[i, j]` for collision pairs. */
  drone?: number | [number, number];
  /** Sample time (s) when the issue was observed. */
  time?: number;
  /** Numeric measurement (e.g. observed speed, distance). */
  value?: number;
  /** Configured limit that was breached. */
  limit?: number;
}

export interface PhysicsLimits {
  /** Hard ceiling on horizontal/vertical speed (m/s). */
  maxSpeed: number;
  /** Optional accel limit (m/s²). When omitted the validator skips accel checks. */
  maxAcceleration?: number;
  /** Optional jerk limit (m/s³). When omitted the validator skips jerk checks. */
  maxJerk?: number;
  /** Minimum drone-to-drone separation at any sampled time (m). */
  minSeparation: number;
  /** World bounds the swarm must stay inside (always enforced). */
  bounds?: Bounds;
}

export interface MatchAssignment {
  /** to[i] is the index of `targets` matched to `sources[i]`. */
  to: number[];
  /** Total Euclidean cost across the matching. */
  totalCost: number;
  /** Strategy actually used. */
  strategy: 'greedy' | 'hungarian-fallback';
}

export interface PhysicalTrajectory {
  /** dronePaths[i] is the ordered samples for drone i. */
  dronePaths: Vec3[][];
  /** Wall-clock time (s) for each sample. Same length as every dronePaths[i]. */
  times: number[];
  /** Sample rate that was used (Hz). */
  sampleRate: number;
  /** Total duration in seconds. */
  duration: number;
}

export interface PhysicsReport {
  ok: boolean;
  issues: PhysicsIssue[];
  /** Hard cap on issues array — see capIssues(). */
  truncated: boolean;
  metrics: {
    droneCount: number;
    sampleRate: number;
    sampleCount: number;
    duration: number;
    adjustedDuration: number;
    maxSpeedUsed: number;
    maxAccelerationUsed: number;
    maxJerkUsed: number;
    minDistanceObserved: number;
    collisionCount: number;
  };
  /** Repair audit trail (empty when no repair was attempted). */
  repairLog: string[];
}

export const DEFAULT_MAX_ISSUES = 200;

/** Cap an issues array in-place; sets truncated=true on overflow. */
export function capIssues(
  issues: PhysicsIssue[],
  max: number = DEFAULT_MAX_ISSUES,
): { issues: PhysicsIssue[]; truncated: boolean } {
  if (issues.length <= max) return { issues, truncated: false };
  return { issues: issues.slice(0, max), truncated: true };
}
