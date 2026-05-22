/**
 * SwarmGPT Physics — Altitude lanes.
 *
 * Splits a swarm into altitude lanes (groups) so transitions don't all
 * cross at the same Y level. Returns per-drone Y-offsets that callers feed
 * into `compilePhysicalTrajectory.laneOffsets`.
 *
 * Strategy: sort drones by 2D travel direction (yaw between source and
 * target on the XZ plane), bucket into N lanes, assign each lane a height
 * offset evenly spaced around 0.
 *
 * Pure: deterministic ordering, no random.
 */
import type { Vec3 } from '../types';

export interface AltitudeLanesOptions {
  /** Number of lanes. Default 3 (low / mid / high). */
  laneCount?: number;
  /** Maximum vertical offset of the outermost lane (m). Default 6. */
  maxOffset?: number;
}

export interface AltitudeLanesResult {
  /** Per-source-drone Y offset to add to the eased mid-trajectory. */
  laneOffsets: number[];
  /** Per-source-drone lane index. */
  laneIndex: number[];
}

export function buildAltitudeLanes(
  sources: Vec3[],
  targets: Vec3[],
  match: { to: number[] },
  options: AltitudeLanesOptions = {},
): AltitudeLanesResult {
  const n = sources.length;
  const laneCount = Math.max(1, Math.floor(options.laneCount ?? 3));
  const maxOffset = Math.max(0, options.maxOffset ?? 6);

  const yaws: { idx: number; yaw: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const src = sources[i];
    const tgtIdx = match.to[i];
    const tgt = tgtIdx >= 0 ? targets[tgtIdx] : src;
    const dx = tgt.x - src.x;
    const dz = tgt.z - src.z;
    yaws[i] = { idx: i, yaw: Math.atan2(dz, dx) };
  }
  yaws.sort((a, b) => a.yaw - b.yaw);

  const laneIndex = new Array<number>(n).fill(0);
  const laneOffsets = new Array<number>(n).fill(0);
  const perLane = Math.max(1, Math.floor(n / laneCount));

  for (let k = 0; k < n; k++) {
    const lane = Math.min(laneCount - 1, Math.floor(k / perLane));
    const idx = yaws[k].idx;
    laneIndex[idx] = lane;
    if (laneCount === 1) {
      laneOffsets[idx] = 0;
    } else {
      // Map lane index ∈ [0..laneCount-1] → offset ∈ [-maxOffset..+maxOffset]
      const t = lane / (laneCount - 1); // 0..1
      laneOffsets[idx] = (t - 0.5) * 2 * maxOffset;
    }
  }
  return { laneOffsets, laneIndex };
}
