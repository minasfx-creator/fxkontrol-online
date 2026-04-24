/**
 * SwarmGPT Physics — Cost-based point matching.
 *
 * Pairs source drones with target slots while minimizing total travel cost.
 * Greedy by default (O(N²) but cheap and stable); falls back to the existing
 * O(N³) Hungarian implementation when the caller asks for `'hungarian'` and
 * the swarm size fits the cap.
 *
 * Pure: no side effects, no allocations beyond the assignment array.
 */
import type { Vec3 } from '../types';
import { distance3 } from '../utils/geometry';
import {
  matchPointsByHungarian,
  shouldUseHungarian,
} from '../advanced/motion/hungarianOptimal';
import type { MatchAssignment } from './types';

export interface MatchPointsByCostOptions {
  /**
   *  - 'greedy' (default): nearest-available-target. Fast, deterministic,
   *    O(N²). Suitable for any size.
   *  - 'hungarian': true Kuhn–Munkres for n ≤ MAX_HUNGARIAN_N. Falls back to
   *    greedy when the cap is exceeded — the report carries
   *    `strategy: 'hungarian-fallback'`.
   */
  strategy?: 'greedy' | 'hungarian';
}

function totalCostFromIndices(sources: Vec3[], targets: Vec3[], to: number[]): number {
  let total = 0;
  for (let i = 0; i < to.length; i++) {
    const t = targets[to[i]];
    if (!t) continue;
    total += distance3(sources[i], t);
  }
  return total;
}

function greedyMatch(sources: Vec3[], targets: Vec3[]): number[] {
  const n = sources.length;
  const m = targets.length;
  const to = new Array<number>(n).fill(-1);
  const used = new Uint8Array(m);

  // Sort source indices by their distance to the targets' centroid so we
  // pick the most "constrained" drones first — reduces the chance of late
  // drones being stuck with bad-only options.
  let cx = 0, cy = 0, cz = 0;
  for (const t of targets) { cx += t.x; cy += t.y; cz += t.z; }
  cx /= Math.max(1, m); cy /= Math.max(1, m); cz /= Math.max(1, m);
  const centroid: Vec3 = { x: cx, y: cy, z: cz };
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => distance3(sources[a], centroid) - distance3(sources[b], centroid));

  for (const i of order) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < m; j++) {
      if (used[j]) continue;
      const d = distance3(sources[i], targets[j]);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) {
      to[i] = best;
      used[best] = 1;
    }
  }
  return to;
}

export function matchPointsByCost(
  sources: Vec3[],
  targets: Vec3[],
  options: MatchPointsByCostOptions = {},
): MatchAssignment {
  if (sources.length === 0 || targets.length === 0) {
    return { to: [], totalCost: 0, strategy: 'greedy' };
  }
  const wantHungarian = options.strategy === 'hungarian';
  const fits = shouldUseHungarian(sources.length, targets.length);

  if (wantHungarian && fits) {
    const matched = matchPointsByHungarian(sources, targets);
    // Convert the matched-point array back into target indices.
    const used = new Uint8Array(targets.length);
    const to = new Array<number>(sources.length).fill(-1);
    for (let i = 0; i < matched.length; i++) {
      const m = matched[i];
      let bestIdx = -1;
      let bestD = Infinity;
      for (let j = 0; j < targets.length; j++) {
        if (used[j]) continue;
        const t = targets[j];
        if (t.x === m.x && t.y === m.y && t.z === m.z) { bestIdx = j; break; }
        const d = distance3(t, m);
        if (d < bestD) { bestD = d; bestIdx = j; }
      }
      if (bestIdx >= 0) { to[i] = bestIdx; used[bestIdx] = 1; }
    }
    return { to, totalCost: totalCostFromIndices(sources, targets, to), strategy: 'greedy' };
  }

  const to = greedyMatch(sources, targets);
  return {
    to,
    totalCost: totalCostFromIndices(sources, targets, to),
    strategy: wantHungarian && !fits ? 'hungarian-fallback' : 'greedy',
  };
}
