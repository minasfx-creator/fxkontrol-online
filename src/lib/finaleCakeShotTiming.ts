/**
 * Finale 3D — Timing of Shots Within a Cake
 *
 * Pure helper for solving interior shot timing per
 * docs/reference/finale-cake-shot-timing.md.
 *
 * Companion to src/lib/finaleCakeDuration.ts. Data-in / data-out, no side
 * effects, no parser coupling.
 */

export interface UniformShotSeparationInput {
  cakeDuration: number;
  /** Pass 0 when the last shot is not a shell. */
  lastShotLiftIfShell: number;
  numberOfShots: number;
}

/**
 * Step 2 — uniform shooting cake.
 *
 *   ShotSeparation = (CakeDuration − LastShotLiftIfShell) / (NumberOfShots − 1)
 *
 * Returns 0 when numberOfShots ≤ 1.
 */
export function uniformShotSeparation(input: UniformShotSeparationInput): number {
  if (input.numberOfShots <= 1) return 0;
  return (input.cakeDuration - input.lastShotLiftIfShell) / (input.numberOfShots - 1);
}

export interface CakeRowSpec {
  /** Known row duration (first→last shot of the row). Omit to mark unknown. */
  duration?: number;
  /** Known explicit delay before this row. Omit to mark unknown. Ignored for the first row. */
  delayBefore?: number;
  /** Sugar: equivalent to duration: 0. */
  allAtOnce?: boolean;
}

export interface SolveCakeRowTimingInput {
  cakeDuration: number;
  /** Pass 0 when the last shot is not a shell. */
  lastShotLiftIfShell: number;
  /** Rows in shooting order. */
  rows: CakeRowSpec[];
}

export interface ResolvedRow {
  duration: number;
  delayBefore: number;
  durationWasUnknown: boolean;
  delayBeforeWasUnknown: boolean;
}

export interface SolveCakeRowTimingResult {
  timeFirstToLast: number;
  knownSum: number;
  unknownCount: number;
  /** Solved value for each unknown slot. Zero when there are no unknowns. */
  unknownDelay: number;
  /** When unknownCount === 0, residual = timeFirstToLast − knownSum; else 0. */
  slack: number;
  resolvedRows: ResolvedRow[];
}

/**
 * Step 3 — solve mixed-row cake timing.
 *
 * All missing `duration` and `delayBefore` slots are treated as unknown and
 * share the same solved value, per the doc:
 *
 *   "Any unknown delays are assumed to be identical, treating unknown delays
 *    between rows and unknown delays between tubes within rows as all the same."
 *
 * The first row's `delayBefore` is always ignored.
 */
export function solveCakeRowTiming(input: SolveCakeRowTimingInput): SolveCakeRowTimingResult {
  const timeFirstToLast = input.cakeDuration - input.lastShotLiftIfShell;
  let knownSum = 0;
  let unknownCount = 0;

  const flags: Array<{ durUnknown: boolean; gapUnknown: boolean }> = input.rows.map((row, idx) => {
    const hasDuration = typeof row.duration === 'number' || row.allAtOnce === true;
    const durValue = row.allAtOnce ? 0 : row.duration;
    if (hasDuration) knownSum += durValue!;
    else unknownCount += 1;

    let gapUnknown = false;
    if (idx === 0) {
      // First row: no delayBefore contributes.
    } else if (typeof row.delayBefore === 'number') {
      knownSum += row.delayBefore;
    } else {
      gapUnknown = true;
      unknownCount += 1;
    }

    return { durUnknown: !hasDuration, gapUnknown };
  });

  let unknownDelay = 0;
  let slack = 0;
  if (unknownCount > 0) {
    unknownDelay = (timeFirstToLast - knownSum) / unknownCount;
  } else {
    slack = timeFirstToLast - knownSum;
  }

  const resolvedRows: ResolvedRow[] = input.rows.map((row, idx) => {
    const f = flags[idx];
    const duration = f.durUnknown ? unknownDelay : (row.allAtOnce ? 0 : (row.duration ?? 0));
    const delayBefore = idx === 0
      ? 0
      : (f.gapUnknown ? unknownDelay : (row.delayBefore ?? 0));
    return {
      duration,
      delayBefore,
      durationWasUnknown: f.durUnknown,
      delayBeforeWasUnknown: f.gapUnknown,
    };
  });

  return { timeFirstToLast, knownSum, unknownCount, unknownDelay, slack, resolvedRows };
}
