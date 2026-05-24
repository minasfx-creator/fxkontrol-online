/**
 * Finale 3D — Cake and Candle Duration (and Prefire)
 *
 * Pure helper implementing the canonical 8-case matrix from
 * docs/reference/finale-cake-candle-duration.md.
 *
 * Data-in / data-out. No parser coupling, no side effects.
 * Renderer wiring is a separate round.
 */

export type CakeCaseKey =
  | 'single-shell'
  | 'multi-seq-shell-diff'
  | 'multi-seq-shell-same'
  | 'multi-all-shell-diff'
  | 'multi-all-shell-same'
  | 'single-nonshell'
  | 'multi-seq-nonshell'
  | 'multi-all-nonshell';

export interface PrefireInput {
  /** Value in the Prefire script column, or undefined if not set. */
  pfCol?: number;
  /** Value from the VDL "X.X PFT" token, or undefined if not present. */
  pftFromVdl?: number;
  /** Whether the first shot is a shell. */
  firstIsShell: boolean;
  /** Default lift time for the first shell's caliber. Required when firstIsShell. */
  firstShellLift?: number;
}

/**
 * Prefire resolution (applies to all 8 cases):
 *   prefire = PFCol ?? PFT ?? (firstIsShell ? Lift(firstShell) : 0)
 */
export function resolvePrefire(input: PrefireInput): number {
  if (typeof input.pfCol === 'number') return input.pfCol;
  if (typeof input.pftFromVdl === 'number') return input.pftFromVdl;
  if (input.firstIsShell) return input.firstShellLift ?? 0;
  return 0;
}

export interface ClassifyInput {
  shotCount: number;
  allAtOnce: boolean;
  firstIsShell: boolean;
  /** True if the last shot's effect equals the first shot's effect. */
  lastSameAsFirst: boolean;
}

export function classifyCakeShape(c: ClassifyInput): CakeCaseKey {
  const single = c.shotCount <= 1;
  if (c.firstIsShell) {
    if (single) return 'single-shell';
    if (c.allAtOnce) return c.lastSameAsFirst ? 'multi-all-shell-same' : 'multi-all-shell-diff';
    return c.lastSameAsFirst ? 'multi-seq-shell-same' : 'multi-seq-shell-diff';
  }
  if (single) return 'single-nonshell';
  if (c.allAtOnce) return 'multi-all-nonshell';
  return 'multi-seq-nonshell';
}

export interface CakeDurationInput {
  shotCount: number;
  allAtOnce: boolean;
  firstIsShell: boolean;
  lastSameAsFirst: boolean;
  /** Default lift for the first shell's caliber (sec). Required when firstIsShell. */
  firstShellLift?: number;
  /** Default lift for the last shell's caliber (sec). Used only when last is shell. */
  lastShellLift?: number;
  /** Whether the last shot is a shell. */
  lastIsShell: boolean;
  /** Expiration time of stars/emission for the last shot (sec from t=0 of effect). */
  expireLastStars: number;
  /** Launch time of the first shot relative to t=0 (sec). For single-shot → 0. */
  firstLaunchTime: number;
  /** Effect time of the last shot: break time if shell, launch time otherwise. */
  effectTimeLast: number;
  /** Prefire inputs. */
  prefire: PrefireInput;
}

export interface CakeDurationResult {
  duration: number;
  prefireUsed: number;
  caseKey: CakeCaseKey;
  /** True if the first shell's lift was adjusted to equal the prefire (≥0.5). */
  liftAdjusted: boolean;
}

/**
 * Computes Duration per the 8-case matrix.
 *
 * NOTE: This helper does NOT mutate launch/break times — it assumes the
 * caller has already applied launch delays for `prefire < 0.5` cases.
 * The matrix here uses `effectTimeLast` / `firstLaunchTime` as inputs.
 */
export function computeCakeDuration(input: CakeDurationInput): CakeDurationResult {
  const prefireUsed = resolvePrefire(input.prefire);
  const caseKey = classifyCakeShape({
    shotCount: input.shotCount,
    allAtOnce: input.allAtOnce,
    firstIsShell: input.firstIsShell,
    lastSameAsFirst: input.lastSameAsFirst,
  });
  const liftAdjusted = input.firstIsShell && prefireUsed >= 0.5;

  let duration = 0;
  switch (caseKey) {
    case 'single-shell': {
      const lift = input.firstShellLift ?? 0;
      duration = prefireUsed >= 0.5
        ? input.expireLastStars - prefireUsed
        : input.expireLastStars - (prefireUsed + lift);
      break;
    }
    case 'multi-seq-shell-diff':
    case 'multi-seq-shell-same':
    case 'multi-seq-nonshell': {
      duration = input.effectTimeLast - input.firstLaunchTime;
      break;
    }
    case 'multi-all-shell-diff':
    case 'multi-all-shell-same':
    case 'multi-all-nonshell': {
      duration = 0;
      break;
    }
    case 'single-nonshell': {
      duration = input.expireLastStars - input.firstLaunchTime;
      break;
    }
  }

  return { duration, prefireUsed, caseKey, liftAdjusted };
}

/**
 * Basic sequential shooting cake — uniform delay between shots.
 *
 *   ShotSeparation = (CakeDuration − LastShotLiftIfShell) / (NumberOfShots − 1)
 *
 * Subtract the last shot's lift ONLY when the last shot is a shell.
 * Returns 0 when numberOfShots <= 1 (no inter-shot gap).
 */
export function shotSeparation(args: {
  cakeDuration: number;
  lastShotLiftIfShell: number; // pass 0 when last is not a shell
  numberOfShots: number;
}): number {
  if (args.numberOfShots <= 1) return 0;
  return (args.cakeDuration - args.lastShotLiftIfShell) / (args.numberOfShots - 1);
}
