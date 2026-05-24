/**
 * ═══════════════════════════════════════════════════════════════════════
 * VDL Row Firing Patterns — Canonical Resolver
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Pure module. Given a row of N tubes and a VDL firing-pattern keyword,
 * returns per-tube { angleDeg, delayMs }.
 *
 * Spec: docs/reference/vdl-firing-patterns.md (Table 1, 25 keywords + 8 aliases).
 *
 * Conventions:
 *   - tubeIndex 0..N-1, left → right (physical row order).
 *   - angleDeg: signed. + = leaning right of vertical. 0 = straight up.
 *   - delayMs: ms offset from row-trigger. 0 for all-at-once patterns.
 *   - Aliases (STW, AGW, AGT, FNW, ATF, BKW, BKT, CRN) normalize to canonical.
 *
 * Zero side effects, zero allocations beyond the returned array.
 */

export type FiringPatternKeyword =
  | 'STR' | 'STL' | 'STT'
  | 'ALR' | 'ALL' | 'ALT'
  | 'ARR' | 'ARL' | 'ART'
  | 'FNR' | 'FNL' | 'FNT'
  | 'BLR' | 'BLL' | 'BLT'
  | 'BRR' | 'BRL' | 'BRT'
  | 'CTO' | 'OTC'
  | 'TRI' | 'TRX' | 'TRS'
  | 'VST' | 'VSS';

export interface TubeFiring {
  tubeIndex: number;
  angleDeg: number;
  delayMs: number;
}

export interface RowPatternOptions {
  tubeCount: number;
  pattern: string;            // accepts canonical keyword OR alias OR lowercase
  spacingMs?: number;         // default 80
  fanAngleDeg?: number;       // default 45
}

const ALIASES: Record<string, FiringPatternKeyword> = {
  STW: 'STR',
  AGW: 'ALR',
  AGT: 'ALT',
  FNW: 'FNR',
  ATF: 'FNT',
  BKW: 'BLR',
  BKT: 'BLT',
  CRN: 'CTO',
};

const CANONICAL_SET: Set<string> = new Set([
  'STR','STL','STT','ALR','ALL','ALT','ARR','ARL','ART',
  'FNR','FNL','FNT','BLR','BLL','BLT','BRR','BRL','BRT',
  'CTO','OTC','TRI','TRX','TRS','VST','VSS',
]);

/** Normalize input pattern string to a canonical keyword. Returns null if unknown. */
export function normalizeFiringPattern(p: string): FiringPatternKeyword | null {
  if (!p) return null;
  const u = p.trim().toUpperCase();
  if (CANONICAL_SET.has(u)) return u as FiringPatternKeyword;
  if (ALIASES[u]) return ALIASES[u];
  return null;
}

/** All canonical keywords (excludes aliases). */
export function listFiringPatterns(): FiringPatternKeyword[] {
  return Array.from(CANONICAL_SET) as FiringPatternKeyword[];
}

/**
 * Build a fan angle for tube i of N: -fan..+fan linearly across the row.
 * If N==1, returns 0.
 */
function fanAngle(i: number, n: number, fan: number): number {
  if (n <= 1) return 0;
  return -fan + (2 * fan * i) / (n - 1);
}

/**
 * Sequential delays from one end.
 * dir: 'L2R' delays = [0, s, 2s, …]; 'R2L' reversed (rightmost = 0).
 */
function seqDelays(n: number, spacing: number, dir: 'L2R' | 'R2L'): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const order = dir === 'L2R' ? i : (n - 1 - i);
    out[i] = order * spacing;
  }
  return out;
}

/**
 * Compute per-tube firing schedule for a single row.
 */
export function computeRowFiring(opts: RowPatternOptions): TubeFiring[] {
  const n = Math.max(0, Math.floor(opts.tubeCount));
  if (n === 0) return [];
  const spacing = opts.spacingMs ?? 80;
  const fan = opts.fanAngleDeg ?? 45;
  const canon = normalizeFiringPattern(opts.pattern) ?? 'STR';

  // Helper to materialize result
  const make = (angles: number[], delays: number[]): TubeFiring[] => {
    const out = new Array<TubeFiring>(n);
    for (let i = 0; i < n; i++) {
      out[i] = { tubeIndex: i, angleDeg: angles[i], delayMs: delays[i] };
    }
    return out;
  };

  // ── Straight family ──
  if (canon === 'STR') return make(new Array(n).fill(0), seqDelays(n, spacing, 'L2R'));
  if (canon === 'STL') return make(new Array(n).fill(0), seqDelays(n, spacing, 'R2L'));
  if (canon === 'STT') return make(new Array(n).fill(0), new Array(n).fill(0));

  // ── All-Leaning Left (\\\) ──
  if (canon === 'ALR') return make(new Array(n).fill(-fan), seqDelays(n, spacing, 'L2R'));
  if (canon === 'ALL') return make(new Array(n).fill(-fan), seqDelays(n, spacing, 'R2L'));
  if (canon === 'ALT') return make(new Array(n).fill(-fan), new Array(n).fill(0));

  // ── All-Leaning Right (///) ──
  if (canon === 'ARR') return make(new Array(n).fill(+fan), seqDelays(n, spacing, 'L2R'));
  if (canon === 'ARL') return make(new Array(n).fill(+fan), seqDelays(n, spacing, 'R2L'));
  if (canon === 'ART') return make(new Array(n).fill(+fan), new Array(n).fill(0));

  // ── Fan (\|/) ──
  if (canon === 'FNR' || canon === 'FNL' || canon === 'FNT') {
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) angles[i] = fanAngle(i, n, fan);
    const delays = canon === 'FNT'
      ? new Array(n).fill(0)
      : seqDelays(n, spacing, canon === 'FNR' ? 'L2R' : 'R2L');
    return make(angles, delays);
  }

  // ── Left Bookend (\|): left half leans left, right half straight ──
  if (canon === 'BLR' || canon === 'BLL' || canon === 'BLT') {
    const half = Math.floor(n / 2);
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) angles[i] = i < half ? -fan : 0;
    const delays = canon === 'BLT'
      ? new Array(n).fill(0)
      : seqDelays(n, spacing, canon === 'BLR' ? 'L2R' : 'R2L');
    return make(angles, delays);
  }

  // ── Right Bookend (|/): left half straight, right half leans right ──
  if (canon === 'BRR' || canon === 'BRL' || canon === 'BRT') {
    const half = Math.ceil(n / 2);
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) angles[i] = i < half ? 0 : +fan;
    const delays = canon === 'BRT'
      ? new Array(n).fill(0)
      : seqDelays(n, spacing, canon === 'BRR' ? 'L2R' : 'R2L');
    return make(angles, delays);
  }

  // ── Center-Out (CTO): fan, ignites center first, expands outward ──
  if (canon === 'CTO') {
    const angles = new Array<number>(n);
    const delays = new Array<number>(n);
    const center = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      angles[i] = fanAngle(i, n, fan);
      delays[i] = Math.round(Math.abs(i - center)) * spacing;
    }
    return make(angles, delays);
  }

  // ── Outside-In (OTC): fan, both ends first, converge to center ──
  if (canon === 'OTC') {
    const angles = new Array<number>(n);
    const delays = new Array<number>(n);
    const center = (n - 1) / 2;
    const maxStep = Math.round(center);
    for (let i = 0; i < n; i++) {
      angles[i] = fanAngle(i, n, fan);
      delays[i] = (maxStep - Math.round(Math.abs(i - center))) * spacing;
    }
    return make(angles, delays);
  }

  // ── W-Shape: row split into 3 groups (left-lean, straight, right-lean) ──
  // TRI = remainder added to straight middle; TRX = remainder added to angled outers.
  if (canon === 'TRI' || canon === 'TRX') {
    const base = Math.floor(n / 3);
    const rem = n % 3;
    let leftCount: number, midCount: number, rightCount: number;
    if (canon === 'TRI') {
      leftCount = base;
      rightCount = base;
      midCount = base + rem;
    } else {
      // TRX: distribute remainder to outer groups (left first if odd)
      const extraLeft = Math.ceil(rem / 2);
      const extraRight = Math.floor(rem / 2);
      leftCount = base + extraLeft;
      rightCount = base + extraRight;
      midCount = base;
    }
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      if (i < leftCount) angles[i] = -fan;
      else if (i < leftCount + midCount) angles[i] = 0;
      else angles[i] = +fan;
    }
    return make(angles, new Array(n).fill(0));
  }

  // ── TRS: sequence of W's, each W = 3 tubes (1 from each group of equivalent column).
  // Per spec: floor(N/3) W's, each fired in order; within a W, the 3 tubes ignite together.
  // Inter-W spacing = spacingMs. Remainder handling matches the doc.
  if (canon === 'TRS') {
    const base = Math.floor(n / 3);
    const rem = n % 3;
    // Geometry identical to TRI (remainder in middle straight group):
    const leftCount = base;
    const midCount = base + rem;
    const rightCount = base;
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      if (i < leftCount) angles[i] = -fan;
      else if (i < leftCount + midCount) angles[i] = 0;
      else angles[i] = +fan;
    }
    const delays = new Array<number>(n).fill(0);
    const wCount = Math.max(1, base);
    // Each W k (0..wCount-1) consists of: leftCount-1-k from left (right end of left group),
    // leftCount + k from middle (left end of middle), and leftCount+midCount + k from right.
    for (let k = 0; k < wCount; k++) {
      const t = k * spacing;
      const leftTube = leftCount - 1 - k;
      const midTube = leftCount + k;
      const rightTube = leftCount + midCount + k;
      if (leftTube >= 0) delays[leftTube] = t;
      if (midTube < leftCount + midCount) delays[midTube] = t;
      if (rightTube < n) delays[rightTube] = t;
    }
    // Special remainder handling for first W:
    if (rem === 1) {
      // first W has 4 tubes (the extra leftmost-center tube also fires)
      const extraTube = leftCount + 1; // second tube in middle group
      if (extraTube < leftCount + midCount) delays[extraTube] = 0;
    } else if (rem === 2) {
      // first W has 5 tubes
      const extra1 = leftCount;       // leftmost of middle (already included)
      const extra2 = leftCount + 1;
      const extra3 = leftCount + 2;
      [extra1, extra2, extra3].forEach((idx) => {
        if (idx >= leftCount && idx < leftCount + midCount) delays[idx] = 0;
      });
    }
    return make(angles, delays);
  }

  // ── V-Shape (\/): left half leans left, right half leans right, NO straight center ──
  if (canon === 'VST' || canon === 'VSS') {
    const half = Math.floor(n / 2);
    const angles = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      if (n % 2 === 1 && i === half) {
        // odd N: middle tube — split convention: lean slightly left
        angles[i] = -fan * 0.25;
      } else if (i < half) {
        angles[i] = -fan;
      } else {
        angles[i] = +fan;
      }
    }
    const delays = new Array<number>(n).fill(0);
    if (canon === 'VSS') {
      // Sequence of symmetric pairs from center outward.
      // For even N the two center tubes share offset 0; pairs expand outward integer-stepped.
      const halfFloat = (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        const raw = Math.abs(i - halfFloat);
        const step = n % 2 === 0 ? Math.max(0, raw - 0.5) : raw;
        delays[i] = Math.round(step) * spacing;
      }
    }
    return make(angles, delays);
  }

  // Fallback (should be unreachable due to default to STR above)
  return make(new Array(n).fill(0), seqDelays(n, spacing, 'L2R'));
}
