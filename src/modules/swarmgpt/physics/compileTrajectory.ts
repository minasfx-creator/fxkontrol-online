/**
 * SwarmGPT Physics — Compile a per-drone sampled trajectory.
 *
 * Given matched source/target pairs, an easing function, and a sample rate,
 * produce `PhysicalTrajectory` (per-drone position arrays + shared time
 * vector). This is the substrate for every downstream validator.
 *
 * Pure: no allocations beyond the output arrays.
 */
import type { Vec3 } from '../types';
import type { MatchAssignment, PhysicalTrajectory } from './types';

export interface CompileTrajectoryOptions {
  /** Total transition duration in seconds (must be > 0). */
  duration: number;
  /** Samples per second. */
  sampleRate: number;
  /** Optional custom easing (default linear). */
  ease?: (t: number) => number;
  /** Optional per-drone altitude offset added to the eased Y mid-curve. */
  laneOffsets?: number[];
}

const linear = (t: number) => t;

export function compilePhysicalTrajectory(
  sources: Vec3[],
  targets: Vec3[],
  match: MatchAssignment,
  options: CompileTrajectoryOptions,
): PhysicalTrajectory {
  const duration = Math.max(0.001, options.duration);
  const rate = Math.max(1, options.sampleRate);
  const sampleCount = Math.max(2, Math.ceil(rate * duration) + 1);
  const dt = duration / (sampleCount - 1);
  const ease = options.ease ?? linear;
  const laneOffsets = options.laneOffsets ?? [];

  const times = new Array<number>(sampleCount);
  for (let s = 0; s < sampleCount; s++) times[s] = s * dt;

  const dronePaths: Vec3[][] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const tgtIdx = match.to[i];
    const tgt = tgtIdx >= 0 ? targets[tgtIdx] : src;
    const lane = laneOffsets[i] ?? 0;

    const path: Vec3[] = new Array(sampleCount);
    for (let s = 0; s < sampleCount; s++) {
      const u = ease(times[s] / duration);
      // Lane bump — a triangular lift centered at u=0.5 so endpoints stay clean.
      const laneBump = lane === 0 ? 0 : lane * 4 * u * (1 - u);
      path[s] = {
        x: src.x + (tgt.x - src.x) * u,
        y: src.y + (tgt.y - src.y) * u + laneBump,
        z: src.z + (tgt.z - src.z) * u,
      };
    }
    dronePaths.push(path);
  }

  return { dronePaths, times, sampleRate: rate, duration };
}
