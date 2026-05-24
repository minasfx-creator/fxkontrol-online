/**
 * VDL Adjustment Adjectives — typed view over the parser's `adjustments[]`.
 *
 * Doc canônica: docs/reference/vdl-adjustment-adjectives.md
 *
 * The parser (`src/lib/vdlParser.ts`) already extracts the raw adjective
 * strings (e.g. "very big", "bright trail") into `result.adjustments`
 * and compounds repetitions multiplicatively. This module provides a typed
 * structural view + angle helper without mutating parser behaviour.
 */

export type AdjustmentKind =
  | 'spread'           // Big / Small         → mine spread / shell break
  | 'brightness'       // Bright / Dim        → stars + trails
  | 'trailBrightness'  // Bright Trail / Dim Trail
  | 'tipBrightness'    // Bright Tip / Dim Tip → just the stars
  | 'stars'            // Dense / Sparse      → star count
  | 'trailThickness'   // Thick / Thin
  | 'trailLength'      // Long Trail / Short Trail (note: "trail", not "tail")
  | 'duration'         // Long / Short        → star duration
  | 'droopy'           // Droopy              → gerb/fountain spark hang
  | 'ragged'           // Ragged              → uneven break pattern
  | 'uniform'          // Uniform             → regular break pattern
  | 'speed'            // Slow / Fast         (Finale extension)
  | 'height';          // High / Low          (Finale extension)

/**
 * Intensity on a -3..+3 scale.
 *   -3 = "very <down>"   (e.g. "very small")
 *   -2 = "<down>"        (e.g. "small")
 *   -1 = "slightly <down>"
 *   +1 = "slightly <up>"
 *   +2 = "<up>"          (e.g. "big")
 *   +3 = "very <up>"
 */
export type AdjustmentIntensity = -3 | -2 | -1 | 1 | 2 | 3;

export interface TypedAdjustment {
  /** The original adjective lowercased, exactly as the parser saw it. */
  term: string;
  /** Which factor of the effect this adjective modifies. */
  kind: AdjustmentKind;
  /** Polarity + magnitude on the -3..+3 scale. */
  intensity: AdjustmentIntensity;
  /**
   * Multiplicative factor relative to baseline 1.0 (e.g. 1.5, 0.4).
   * Stays in sync with `VDL_ADJUSTMENTS` in `vdlParser.ts`.
   */
  value: number;
}

// ── Lookup: term → typed entry. Mirrors vdlParser.VDL_ADJUSTMENTS. ──
//
// Kept here as a static map so the typed view is independent of the
// parser internals. If the parser table grows, update this map too.
const ADJ_MAP: Record<string, Omit<TypedAdjustment, 'term'>> = {
  // Size (spread)
  'very big':        { kind: 'spread', intensity: 3,  value: 1.5  },
  'big':             { kind: 'spread', intensity: 2,  value: 1.25 },
  'slightly big':    { kind: 'spread', intensity: 1,  value: 1.1  },
  'slightly small':  { kind: 'spread', intensity: -1, value: 0.9  },
  'small':           { kind: 'spread', intensity: -2, value: 0.75 },
  'very small':      { kind: 'spread', intensity: -3, value: 0.6  },
  // Legacy aliases (Finale "large" === "big")
  'very large':      { kind: 'spread', intensity: 3,  value: 1.5  },
  'large':           { kind: 'spread', intensity: 2,  value: 1.25 },
  'slightly large':  { kind: 'spread', intensity: 1,  value: 1.1  },

  // Brightness (star + trail combined)
  'very bright':       { kind: 'brightness', intensity: 3,  value: 1.5  },
  'bright':            { kind: 'brightness', intensity: 2,  value: 1.25 },
  'slightly bright':   { kind: 'brightness', intensity: 1,  value: 1.1  },
  'slightly dim':      { kind: 'brightness', intensity: -1, value: 0.9  },
  'dim':               { kind: 'brightness', intensity: -2, value: 0.7  },
  'very dim':          { kind: 'brightness', intensity: -3, value: 0.5  },

  // Trail brightness
  'very bright trail':       { kind: 'trailBrightness', intensity: 3,  value: 1.5  },
  'bright trail':            { kind: 'trailBrightness', intensity: 2,  value: 1.25 },
  'slightly bright trail':   { kind: 'trailBrightness', intensity: 1,  value: 1.1  },
  'slightly dim trail':      { kind: 'trailBrightness', intensity: -1, value: 0.9  },
  'dim trail':               { kind: 'trailBrightness', intensity: -2, value: 0.7  },
  'very dim trail':          { kind: 'trailBrightness', intensity: -3, value: 0.5  },

  // Tip brightness (stars-only)
  'very bright tip':         { kind: 'tipBrightness', intensity: 3,  value: 1.5  },
  'bright tip':              { kind: 'tipBrightness', intensity: 2,  value: 1.25 },
  'slightly bright tip':     { kind: 'tipBrightness', intensity: 1,  value: 1.1  },
  'slightly dim tip':        { kind: 'tipBrightness', intensity: -1, value: 0.9  },
  'dim tip':                 { kind: 'tipBrightness', intensity: -2, value: 0.7  },
  'very dim tip':            { kind: 'tipBrightness', intensity: -3, value: 0.5  },

  // Density (star count)
  'very dense':              { kind: 'stars', intensity: 3,  value: 2.0  },
  'dense':                   { kind: 'stars', intensity: 2,  value: 1.5  },
  'slightly dense':          { kind: 'stars', intensity: 1,  value: 1.2  },
  'slightly sparse':         { kind: 'stars', intensity: -1, value: 0.8  },
  'sparse':                  { kind: 'stars', intensity: -2, value: 0.6  },
  'very sparse':             { kind: 'stars', intensity: -3, value: 0.4  },

  // Trail thickness
  'very thick':              { kind: 'trailThickness', intensity: 3,  value: 2.0 },
  'thick':                   { kind: 'trailThickness', intensity: 2,  value: 1.5 },
  'slightly thick':          { kind: 'trailThickness', intensity: 1,  value: 1.2 },
  'slightly thin':           { kind: 'trailThickness', intensity: -1, value: 0.8 },
  'thin':                    { kind: 'trailThickness', intensity: -2, value: 0.6 },
  'very thin':               { kind: 'trailThickness', intensity: -3, value: 0.4 },

  // Trail length (doc note: "trail", not "tail")
  'very long trail':         { kind: 'trailLength', intensity: 3,  value: 2.0 },
  'long trail':              { kind: 'trailLength', intensity: 2,  value: 1.5 },
  'slightly long trail':     { kind: 'trailLength', intensity: 1,  value: 1.2 },
  'slightly short trail':    { kind: 'trailLength', intensity: -1, value: 0.8 },
  'short trail':             { kind: 'trailLength', intensity: -2, value: 0.6 },
  'very short trail':        { kind: 'trailLength', intensity: -3, value: 0.4 },

  // Duration (star duration)
  'very long':               { kind: 'duration', intensity: 3,  value: 1.5  },
  'long':                    { kind: 'duration', intensity: 2,  value: 1.25 },
  'slightly long':           { kind: 'duration', intensity: 1,  value: 1.1  },
  'slightly short':          { kind: 'duration', intensity: -1, value: 0.9  },
  'short':                   { kind: 'duration', intensity: -2, value: 0.75 },
  'very short':              { kind: 'duration', intensity: -3, value: 0.6  },

  // Droopy (gerb/fountain spark hang time)
  'very droopy':             { kind: 'droopy', intensity: 3,  value: 1.5  },
  'droopy':                  { kind: 'droopy', intensity: 2,  value: 1.25 },
  'slightly droopy':         { kind: 'droopy', intensity: 1,  value: 1.1  },

  // Ragged break
  'very ragged':             { kind: 'ragged', intensity: 3,  value: 1.5  },
  'ragged':                  { kind: 'ragged', intensity: 2,  value: 1.25 },
  'slightly ragged':         { kind: 'ragged', intensity: 1,  value: 1.1  },

  // Uniform break
  'very uniform':            { kind: 'uniform', intensity: 3,  value: 1.5  },
  'uniform':                 { kind: 'uniform', intensity: 2,  value: 1.25 },
  'slightly uniform':        { kind: 'uniform', intensity: 1,  value: 1.1  },

  // Finale extensions (not in the May 23, 2024 adjective table)
  'slow':                    { kind: 'speed', intensity: -2, value: 0.7 },
  'fast':                    { kind: 'speed', intensity: 2,  value: 1.4 },
  'high':                    { kind: 'height', intensity: 2,  value: 1.3 },
  'low':                     { kind: 'height', intensity: -2, value: 0.7 },
};

/**
 * Map the parser's raw `adjustments` strings into typed entries.
 * Unknown terms are silently dropped (the parser only emits known ones).
 */
export function toTypedAdjustments(adjustments: readonly string[]): TypedAdjustment[] {
  const out: TypedAdjustment[] = [];
  for (const term of adjustments) {
    const entry = ADJ_MAP[term];
    if (entry) out.push({ term, ...entry });
  }
  return out;
}

/**
 * Compound multiplicative factor per adjustment kind. Each repetition of
 * a term multiplies (Finale doc: "Very Big Very Big" stacks further).
 */
export function summarizeAdjustments(
  adjustments: readonly string[],
): Partial<Record<AdjustmentKind, number>> {
  const out: Partial<Record<AdjustmentKind, number>> = {};
  for (const a of toTypedAdjustments(adjustments)) {
    out[a.kind] = (out[a.kind] ?? 1) * a.value;
  }
  return out;
}

/**
 * Parse an R/L angle adjective from a VDL string.
 *
 * Grammar: `R<deg>` tilts right, `L<deg>` tilts left, with `deg` in
 *   { 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180 }.
 *
 * Returns the signed offset in degrees (R positive, L negative),
 * or `null` if no recognised angle adjective is present.
 * Multiple matches: last occurrence wins (matches parser behaviour).
 */
export function parseAngleOffset(raw: string): number | null {
  // Iterate right-then-left, keeping the last match in source order.
  const matches: Array<{ sign: 1 | -1; deg: number; index: number }> = [];
  const RIGHT = /\bR(\d+)\b/g;
  const LEFT = /\bL(\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = RIGHT.exec(raw)) !== null) {
    matches.push({ sign: 1, deg: parseInt(m[1], 10), index: m.index });
  }
  while ((m = LEFT.exec(raw)) !== null) {
    matches.push({ sign: -1, deg: parseInt(m[1], 10), index: m.index });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.index - b.index);
  const last = matches[matches.length - 1];
  return last.sign * last.deg;
}

/** Canonical angle vocabulary recognised by VDL (15° steps, 15..180). */
export const VDL_ANGLE_STEPS: readonly number[] = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
];
