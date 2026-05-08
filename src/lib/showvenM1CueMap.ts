/**
 * ─── Showven M1 — 128-cue address map ──────────────────────────────
 *
 * Pure, deterministic mapping table that translates a global
 * `cueIndex ∈ [1, 128]` into the PBus `(slaveAddress, channel)` pair
 * the FXcommander/M1 master uses on the wire.
 *
 * Default canonical layout (FXcommander Pro convention):
 *
 *   cue   1..16  → slave 1, ch 1..16
 *   cue  17..32  → slave 2, ch 1..16
 *   ...
 *   cue 113..128 → slave 8, ch 1..16
 *
 * The runtime mapping accepts a sparse override `Record<cueIndex, target>`
 * for shows that wire racks out of order. Override always wins; missing
 * cues fall back to the default layout.
 *
 * Validation rules (`validateM1CueMap`):
 *   • cueIndex MUST be 1..128.
 *   • slaveAddress MUST be 1..16  (PBus address space).
 *   • channel       MUST be 1..16  (C16 channel space).
 *   • No two cues may resolve to the same (slave, channel) pair.
 */

export const M1_TOTAL_CUES = 128;
export const M1_DEFAULT_CHANNELS_PER_SLAVE = 16;
export const M1_MAX_SLAVE_ADDR = 16;
export const M1_MAX_CHANNEL = 16;

export interface M1CueTarget {
  slaveAddress: number; // 1..16
  channel: number;      // 1..16
}

export type M1CueOverride = Readonly<Record<number, M1CueTarget>>;

/** Resolve a single cue using the canonical FXcommander layout. */
export function defaultM1Target(cueIndex: number): M1CueTarget {
  if (!Number.isInteger(cueIndex) || cueIndex < 1 || cueIndex > M1_TOTAL_CUES) {
    throw new RangeError(`cueIndex out of range: ${cueIndex} (expected 1..${M1_TOTAL_CUES})`);
  }
  const zero = cueIndex - 1;
  const slaveAddress = Math.floor(zero / M1_DEFAULT_CHANNELS_PER_SLAVE) + 1;
  const channel = (zero % M1_DEFAULT_CHANNELS_PER_SLAVE) + 1;
  return { slaveAddress, channel };
}

/** Resolve cue with optional override layered on top of the default. */
export function resolveM1Target(
  cueIndex: number,
  override?: M1CueOverride,
): M1CueTarget {
  if (override && Object.prototype.hasOwnProperty.call(override, cueIndex)) {
    const t = override[cueIndex];
    if (!isValidTarget(t)) {
      throw new RangeError(
        `override target invalid for cue ${cueIndex}: slave=${t?.slaveAddress} ch=${t?.channel}`,
      );
    }
    return { slaveAddress: t.slaveAddress, channel: t.channel };
  }
  return defaultM1Target(cueIndex);
}

function isValidTarget(t: M1CueTarget | undefined): t is M1CueTarget {
  if (!t) return false;
  if (!Number.isInteger(t.slaveAddress) || t.slaveAddress < 1 || t.slaveAddress > M1_MAX_SLAVE_ADDR) return false;
  if (!Number.isInteger(t.channel)      || t.channel      < 1 || t.channel      > M1_MAX_CHANNEL) return false;
  return true;
}

export interface M1MapValidation {
  ok: boolean;
  errors: string[];
  /** (slave, channel) → cueIndex of the FIRST cue claiming it. Empty when ok. */
  collisions: Array<{ slaveAddress: number; channel: number; cues: number[] }>;
}

/**
 * Validate a complete cue map for a show.
 *
 * `cueIndices` lists every cue the show declares (typically just `1..N`).
 * `override` is the optional sparse remap. Returns OK when every cue
 * resolves to a unique, in-range (slave, channel).
 */
export function validateM1CueMap(
  cueIndices: ReadonlyArray<number>,
  override?: M1CueOverride,
): M1MapValidation {
  const errors: string[] = [];
  const claim = new Map<string, number[]>();

  for (const cue of cueIndices) {
    if (!Number.isInteger(cue) || cue < 1 || cue > M1_TOTAL_CUES) {
      errors.push(`cue ${cue} out of range 1..${M1_TOTAL_CUES}`);
      continue;
    }
    let target: M1CueTarget;
    try {
      target = resolveM1Target(cue, override);
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    const key = `${target.slaveAddress}:${target.channel}`;
    const list = claim.get(key);
    if (list) list.push(cue); else claim.set(key, [cue]);
  }

  const collisions: M1MapValidation['collisions'] = [];
  for (const [key, cues] of claim) {
    if (cues.length > 1) {
      const [s, c] = key.split(':').map(Number);
      collisions.push({ slaveAddress: s, channel: c, cues });
      errors.push(`cues [${cues.join(', ')}] collide on slave ${s} ch ${c}`);
    }
  }

  return { ok: errors.length === 0, errors, collisions };
}

/** Convenience: full inverse map for a default layout (no overrides). */
export function buildDefaultM1Plan(
  count: number = M1_TOTAL_CUES,
): ReadonlyArray<{ cueIndex: number } & M1CueTarget> {
  const out: Array<{ cueIndex: number } & M1CueTarget> = [];
  for (let i = 1; i <= Math.min(count, M1_TOTAL_CUES); i++) {
    const t = defaultM1Target(i);
    out.push({ cueIndex: i, ...t });
  }
  return out;
}
