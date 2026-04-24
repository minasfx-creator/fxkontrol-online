/**
 * SwarmGPT Advanced — Optimal assignment via Kuhn–Munkres (Hungarian).
 *
 * Solves min-cost bipartite assignment in O(n³). For n drones × m targets we
 * pad to a square `size = max(n, m)` with `Infinity`/`PADDING_COST`. Returns
 * an array `assignment` of length n where `assignment[i]` is the index in the
 * `to` array (or -1 if unmatched / padded).
 *
 * Hard cap: above MAX_HUNGARIAN_N the caller is expected to fall back to the
 * existing greedy matcher — exposed via `shouldUseHungarian`.
 *
 * Pure: no allocations beyond the assignment + temp matrices.
 */
import type { Vec3 } from '../../types';
import { distance3 } from '../../utils/geometry';

export const MAX_HUNGARIAN_N = 512;
const PADDING_COST = 1e9;

export function shouldUseHungarian(fromCount: number, toCount: number): boolean {
  return Math.max(fromCount, toCount) <= MAX_HUNGARIAN_N;
}

/**
 * Solve the square assignment problem. Returns `colForRow[r] = c` such that
 * sum of `cost[r][colForRow[r]]` is minimized.
 *
 * Standard O(n³) Kuhn–Munkres on a 1-indexed cost matrix. Adapted from the
 * canonical algorithm so it handles `Infinity`-padded entries safely.
 */
export function solveHungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  // Algorithm uses 1-indexed arrays; sizes n+1.
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1);
  const way = new Int32Array(n + 1);
  const minv = new Float64Array(n + 1);
  const used = new Uint8Array(n + 1);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);

    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const colForRow = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) colForRow[p[j] - 1] = j - 1;
  }
  return colForRow;
}

/**
 * Match `from` → `to` by minimizing total Euclidean distance.
 * Returns an array of `to` points in the order picked for each `from[i]`,
 * truncated to `from.length`. Unmatched (padded) rows return their nearest
 * available `to` as a graceful fallback.
 */
export function matchPointsByHungarian(from: Vec3[], to: Vec3[]): Vec3[] {
  if (from.length === 0 || to.length === 0) return [];
  const n = Math.max(from.length, to.length);

  // Build squared-distance cost matrix (squared distances preserve argmin and
  // avoid sqrt cost; Hungarian is invariant under monotone cost transforms
  // on the same row/column structure — use real distance for clarity).
  const cost: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(n);
    const f = from[i];
    for (let j = 0; j < n; j++) {
      const t = to[j];
      if (!f || !t) {
        row[j] = PADDING_COST;
      } else {
        row[j] = distance3(f, t);
      }
    }
    cost[i] = row;
  }

  const colForRow = solveHungarian(cost);
  const result: Vec3[] = [];
  const usedTo = new Set<number>();
  for (let i = 0; i < from.length; i++) {
    const j = colForRow[i];
    if (j >= 0 && j < to.length) {
      result.push(to[j]);
      usedTo.add(j);
    } else {
      // Padded row — pick nearest available `to` as graceful degradation.
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < to.length; k++) {
        if (usedTo.has(k)) continue;
        const d = distance3(from[i], to[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0) {
        result.push(to[best]);
        usedTo.add(best);
      }
    }
  }
  return result;
}
