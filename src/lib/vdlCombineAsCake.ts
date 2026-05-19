/**
 * Finale 3D — "Effects > Combine as cake effect…" decision helpers.
 *
 * Pure data-in/data-out. Does NOT emit VDL strings; only decides whether
 * the standard syntax fits, enforces hard limitations, and scores layout
 * squareness. See docs/reference/finale-combine-as-cake.md.
 */

export const COMBINE_AS_CAKE_ANGLE_TOLERANCE_DEG = 5;
export const COMBINE_AS_CAKE_TIME_TOLERANCE_MS = 10;

export interface CombineCakeShot {
  /** Tube size; all shots must share the same size. */
  size: string;
  /** Side-to-side angle in degrees. Out-of-side-to-side range disallowed. */
  angleDeg: number;
  /** Absolute launch time in ms (relative to cake start). */
  timeMs: number;
  /** VDL description for the shot (used to detect '+' multi-break/peanut). */
  vdl: string;
}

export type CombineLimitationCode =
  | 'mixed-tube-sizes'
  | 'non-side-to-side-angle'
  | 'plus-sign-effect';

export interface CombineLimitationViolation {
  code: CombineLimitationCode;
  shotIndex: number;
  detail: string;
}

export interface CombineLimitationResult {
  ok: boolean;
  violations: CombineLimitationViolation[];
}

/** Side-to-side: |angle| <= 90° (front/back tilt disallowed in cake VDL). */
function isSideToSideAngle(deg: number): boolean {
  return Number.isFinite(deg) && Math.abs(deg) <= 90 + 1e-9;
}

export function checkCombineAsCakeLimitations(
  shots: ReadonlyArray<CombineCakeShot>,
): CombineLimitationResult {
  const violations: CombineLimitationViolation[] = [];
  if (shots.length === 0) return { ok: true, violations };

  const firstSize = shots[0].size;
  shots.forEach((s, i) => {
    if (s.size !== firstSize) {
      violations.push({
        code: 'mixed-tube-sizes',
        shotIndex: i,
        detail: `expected size '${firstSize}', got '${s.size}'`,
      });
    }
    if (!isSideToSideAngle(s.angleDeg)) {
      violations.push({
        code: 'non-side-to-side-angle',
        shotIndex: i,
        detail: `angle ${s.angleDeg}° outside side-to-side range`,
      });
    }
    if (s.vdl.includes('+')) {
      violations.push({
        code: 'plus-sign-effect',
        shotIndex: i,
        detail: 'VDL contains "+" (peanut/multi-break) — not allowed in cake',
      });
    }
  });

  return { ok: violations.length === 0, violations };
}

export interface DecideCakeSyntaxOptions {
  /** When true (user ticked the checkbox), always return 'exact'. */
  forceExact?: boolean;
  angleToleranceDeg?: number;
  timeToleranceMs?: number;
}

/**
 * Decide whether the standard syntax can represent the selection within
 * tolerance, or whether the function must fall back to exact syntax.
 *
 * Standard syntax requires:
 *   - Shots grouped into rows where intra-row delays are uniform (±10 ms).
 *   - Angle pattern that matches some standard row pattern within ±5°.
 *
 * Heuristic check pinned here:
 *   - Group shots by timeMs into rows (cluster gap > tolerance).
 *   - Within each row, verify uniform inter-tube spacing.
 *
 * Pattern-name matching (STR/STL/FN-family/...) is decided downstream; this
 * helper returns 'standard' only if uniformity holds, which is the
 * necessary precondition documented by the source material.
 */
export function decideCakeSyntax(
  shots: ReadonlyArray<CombineCakeShot>,
  opts: DecideCakeSyntaxOptions = {},
): 'standard' | 'exact' {
  if (opts.forceExact) return 'exact';
  if (shots.length <= 1) return 'standard';

  const angleTol = opts.angleToleranceDeg ?? COMBINE_AS_CAKE_ANGLE_TOLERANCE_DEG;
  const timeTol = opts.timeToleranceMs ?? COMBINE_AS_CAKE_TIME_TOLERANCE_MS;

  const sorted = [...shots].sort((a, b) => a.timeMs - b.timeMs);
  // Cluster into rows: a new row starts when the inter-shot gap exceeds the
  // largest intra-row gap by more than `timeTol` (simple monotone heuristic).
  const rows: CombineCakeShot[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timeMs - sorted[i - 1].timeMs;
    if (gap <= timeTol) {
      rows[rows.length - 1].push(sorted[i]);
    } else {
      rows.push([sorted[i]]);
    }
  }

  for (const row of rows) {
    if (row.length <= 2) continue;
    const deltas: number[] = [];
    for (let i = 1; i < row.length; i++) deltas.push(row[i].timeMs - row[i - 1].timeMs);
    const min = Math.min(...deltas);
    const max = Math.max(...deltas);
    if (max - min > timeTol) return 'exact';
    // Angle uniformity check: angles must be monotone or symmetric within tol.
    const angles = row.map((r) => r.angleDeg);
    const aMin = Math.min(...angles);
    const aMax = Math.max(...angles);
    const span = aMax - aMin;
    if (span > 0 && span < angleTol) {
      // collapsed — treat as STR; OK
      continue;
    }
    // For larger spans, require even angular spacing within angleTol.
    const sortedAngles = [...angles].sort((a, b) => a - b);
    const step = (sortedAngles[sortedAngles.length - 1] - sortedAngles[0]) /
      (sortedAngles.length - 1);
    for (let i = 1; i < sortedAngles.length; i++) {
      const got = sortedAngles[i] - sortedAngles[i - 1];
      if (Math.abs(got - step) > angleTol) return 'exact';
    }
  }
  return 'standard';
}

/**
 * Lower score = more square-ish layout. Used to pick among multiple
 * feasible standard-syntax representations of the same selection.
 */
export function scoreSquareness(layout: {
  rows: number;
  tubesPerRow: number;
}): number {
  const { rows, tubesPerRow } = layout;
  if (rows <= 0 || tubesPerRow <= 0) return Number.POSITIVE_INFINITY;
  const ratio = Math.max(rows, tubesPerRow) / Math.min(rows, tubesPerRow);
  return ratio - 1; // 0 = perfect square.
}

/**
 * Pick the most square-ish layout from candidates. Stable — ties keep the
 * first candidate in input order.
 */
export function pickSquarestLayout<T extends { rows: number; tubesPerRow: number }>(
  candidates: ReadonlyArray<T>,
): T | null {
  let best: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const s = scoreSquareness(c);
    if (s < bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}
