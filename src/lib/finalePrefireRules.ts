/**
 * Finale 3D — Prefire, LFT, DLY, and firing-system export offset.
 *
 * Pure data-in/data-out helper. See docs/reference/finale-prefire-lft-dly.md.
 */

/** Boundary at which a prefire stops meaning "startup delay" and starts
 *  meaning "aerial shell lift". Inclusive at 0.5 → lift. */
export const PREFIRE_LIFT_BOUNDARY_S = 0.5;

export type PrefireInterpretation =
  | 'delay-before-simulation'
  | 'lift-time';

export function interpretPrefire(seconds: number): PrefireInterpretation {
  return seconds >= PREFIRE_LIFT_BOUNDARY_S
    ? 'lift-time'
    : 'delay-before-simulation';
}

export interface ResolvePrefireInput {
  /** Per-row `Prefire` column value on the effects table. Wins over PFT. */
  prefireColumn?: number;
  /** `PFT` term parsed out of the VDL. */
  pftFromVdl?: number;
  /** Default lift time for the part (fallback when no prefire is set). */
  defaultLift?: number;
  /** `LFT` term parsed out of the VDL — explicit lift override. */
  lftFromVdl?: number;
  /** `DLY` term parsed out of the VDL — explicit delay-before-sim override. */
  dlyFromVdl?: number;
}

export interface ResolvedPrefire {
  /** Final prefire value the renderer should use (PFT/column/default). */
  effectivePrefire: number;
  /** Lift time after applying LFT override or the prefire>=0.5 rule. */
  liftTime: number;
  /** Delay-before-simulation after applying DLY override or prefire<0.5 rule. */
  delayBeforeSimulation: number;
  /** Which source provided `effectivePrefire`. */
  source: 'column' | 'pft' | 'default' | 'none';
}

export function resolvePrefireWithOverrides(
  input: ResolvePrefireInput,
): ResolvedPrefire {
  let effectivePrefire = 0;
  let source: ResolvedPrefire['source'] = 'none';

  if (typeof input.prefireColumn === 'number') {
    effectivePrefire = input.prefireColumn;
    source = 'column';
  } else if (typeof input.pftFromVdl === 'number') {
    effectivePrefire = input.pftFromVdl;
    source = 'pft';
  } else if (typeof input.defaultLift === 'number') {
    effectivePrefire = input.defaultLift;
    source = 'default';
  }

  const interp = interpretPrefire(effectivePrefire);

  // Start from prefire implication, then apply explicit LFT/DLY overrides.
  let liftTime = interp === 'lift-time' ? effectivePrefire : 0;
  let delayBeforeSimulation =
    interp === 'delay-before-simulation' ? effectivePrefire : 0;

  if (typeof input.lftFromVdl === 'number') liftTime = input.lftFromVdl;
  if (typeof input.dlyFromVdl === 'number') {
    delayBeforeSimulation = input.dlyFromVdl;
  }

  return { effectivePrefire, liftTime, delayBeforeSimulation, source };
}

/**
 * Apply the show-level `Firing system export offset` to a prefire.
 *
 * Sign convention (per Finale 3D docs): if the firing system adds +0.1 s of
 * latency, the export offset is set to -0.1, which is *added* to the prefire
 * downstream. So this helper performs straight addition.
 */
export function applyExportOffset(
  prefireSeconds: number,
  exportOffsetSeconds: number,
): number {
  return prefireSeconds + exportOffsetSeconds;
}

/** Measured prefire = delay before launch + lift delay (per docs). */
export function derivePrefireFromMeasured(input: {
  delayBeforeLaunch: number;
  liftDelay: number;
}): number {
  return input.delayBeforeLaunch + input.liftDelay;
}
