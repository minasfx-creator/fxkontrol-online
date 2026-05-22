/**
 * SwarmGPT Physics — Repair pipeline.
 *
 * Tries up to 4 strategies in order to produce a feasible transition:
 *
 *   1. extend duration   — slows the swarm proportionally
 *   2. rematch           — re-runs cost matching on the (possibly worse)
 *                          configuration to escape adversarial pairings
 *   3. altitude lanes    — buckets drones into vertical lanes
 *   4. fail with a clear blocker
 *
 * Pure orchestration — delegates to other physics primitives.
 */
import type { Vec3 } from '../types';
import { matchPointsByCost } from './matchPointsByCost';
import { compilePhysicalTrajectory } from './compileTrajectory';
import { buildAltitudeLanes } from './altitudeLanes';
import { buildPhysicsReport } from './physicsReport';
import { pickAdaptiveSampleRate } from './adaptiveSampling';
import type {
  MatchAssignment,
  PhysicalTrajectory,
  PhysicsLimits,
  PhysicsReport,
} from './types';

export interface RepairOptions {
  duration: number;
  limits: PhysicsLimits;
  /** Easing function used during compilation. Default linear. */
  ease?: (t: number) => number;
  /** Initial assignment. When omitted, a fresh match is computed. */
  initialMatch?: MatchAssignment;
  /** Sampling mode passed through to the adaptive picker. */
  mode?: 'preview' | 'final';
  /** Max issues kept in the resulting report. */
  maxIssues?: number;
  /** Multipliers tried by step 1 (extend duration). Default [1.25, 1.5, 2]. */
  durationMultipliers?: number[];
  /** Lane counts tried by step 3. Default [3, 5]. */
  laneCounts?: number[];
}

export interface RepairResult {
  trajectory: PhysicalTrajectory;
  match: MatchAssignment;
  report: PhysicsReport;
}

function tryCompile(
  sources: Vec3[],
  targets: Vec3[],
  match: MatchAssignment,
  duration: number,
  ease: ((t: number) => number) | undefined,
  laneOffsets: number[] | undefined,
  mode: 'preview' | 'final',
): PhysicalTrajectory {
  const adaptive = pickAdaptiveSampleRate({ droneCount: sources.length, duration, mode });
  return compilePhysicalTrajectory(sources, targets, match, {
    duration,
    sampleRate: adaptive.sampleRate,
    ease,
    laneOffsets,
  });
}

export function repairPhysicalTransition(
  sources: Vec3[],
  targets: Vec3[],
  options: RepairOptions,
): RepairResult {
  const repairLog: string[] = [];
  const mode = options.mode ?? 'final';
  const maxIssues = options.maxIssues;
  const durationMultipliers = options.durationMultipliers ?? [1.25, 1.5, 2];
  const laneCounts = options.laneCounts ?? [3, 5];
  const originalDuration = options.duration;

  // 0) Initial attempt.
  let match = options.initialMatch ?? matchPointsByCost(sources, targets, { strategy: 'greedy' });
  let duration = options.duration;
  let traj = tryCompile(sources, targets, match, duration, options.ease, undefined, mode);
  let report = buildPhysicsReport(traj, { limits: options.limits, maxIssues, originalDuration });
  if (report.ok) return { trajectory: traj, match, report: { ...report, repairLog } };

  // 1) Extend duration.
  for (const mult of durationMultipliers) {
    duration = originalDuration * mult;
    traj = tryCompile(sources, targets, match, duration, options.ease, undefined, mode);
    report = buildPhysicsReport(traj, { limits: options.limits, maxIssues, originalDuration });
    repairLog.push(`extend duration ×${mult.toFixed(2)} → ${duration.toFixed(2)}s`);
    if (report.ok) return { trajectory: traj, match, report: { ...report, repairLog } };
  }

  // 2) Rematch (with hungarian if it fits).
  match = matchPointsByCost(sources, targets, { strategy: 'hungarian' });
  traj = tryCompile(sources, targets, match, duration, options.ease, undefined, mode);
  report = buildPhysicsReport(traj, { limits: options.limits, maxIssues, originalDuration });
  repairLog.push(`rematch via ${match.strategy}`);
  if (report.ok) return { trajectory: traj, match, report: { ...report, repairLog } };

  // 3) Altitude lanes.
  for (const laneCount of laneCounts) {
    const lanes = buildAltitudeLanes(sources, targets, match, { laneCount });
    traj = tryCompile(sources, targets, match, duration, options.ease, lanes.laneOffsets, mode);
    report = buildPhysicsReport(traj, { limits: options.limits, maxIssues, originalDuration });
    repairLog.push(`altitude lanes (${laneCount})`);
    if (report.ok) return { trajectory: traj, match, report: { ...report, repairLog } };
  }

  // 4) Give up — return the best-attempt with a blocker issue.
  repairLog.push('repair failed — returning last attempt');
  const finalReport: PhysicsReport = {
    ...report,
    ok: false,
    issues: [
      ...report.issues,
      {
        kind: 'repair',
        severity: 'blocker',
        message: 'repairPhysicalTransition exhausted all strategies',
      },
    ],
    repairLog,
  };
  return { trajectory: traj, match, report: finalReport };
}
