/**
 * ═══════════════════════════════════════════════════════════════════════
 * VDL Cake Segment Resolver — Finale 3D Spec (HTM, DUR, Degrees)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Reference: docs/reference/vdl-htm-dur-degrees.md (VDL Documentation,
 * "Specifying the height, duration, and fan angle of effects in the cake")
 *
 * Cake descriptions can list multiple ingredient effects separated by `+`,
 * each optionally tagged with its own `<N> HTM` (height in meters) and
 * `<N> DUR` (duration in seconds) override. The cake header may carry a
 * `<N> Degrees` term that constrains the fan angle of any angled rows.
 *
 * This resolver is a pure parser: it splits the cake body, peels off the
 * per-segment HTM/DUR overrides, extracts the cake-level fan angle, and
 * returns a structured shape. It does NOT mutate any renderer state.
 *
 * Example:
 *   50mm 10s 100 Shot 100m 130 Degrees Fan Cake
 *     (a) Gold Tail + (b) 25 HTM 2.3 DUR Red Mine
 *     10 Rows Row 1,2,3,4,5,6,7,8,9,10 (ababababab)
 *
 * → {
 *     fanAngleDeg: 130,
 *     segments: [
 *       { label: 'a', body: 'Gold Tail', htmOverride: -1, durOverride: -1 },
 *       { label: 'b', body: 'Red Mine',  htmOverride: 25, durOverride: 2.3 },
 *     ],
 *   }
 *
 * Conventions (match vdlParser.ts):
 *   - Missing override → -1 (NOT undefined), keeps numeric ergonomics.
 *   - HTM is meters; DUR is seconds; Degrees is degrees.
 *   - Label is the lowercase letter inside `(a)` … `(b)` if present.
 */

export interface CakeSegment {
  /** ingredient label (e.g. 'a', 'b') stripped from leading `(x)`; '' if none */
  label: string;
  /** segment body after stripping `(label)`, HTM, DUR, LFT, DLY; whitespace-trimmed */
  body: string;
  /** -1 if not specified */
  htmOverride: number;
  /** -1 if not specified */
  durOverride: number;
  /** -1 if not specified — per-segment LFT (aerial lift time, seconds) */
  lftOverride: number;
  /** -1 if not specified — per-segment DLY (delay before sim, seconds) */
  dlyOverride: number;
}

export interface CakeSegmentParseResult {
  /** -1 if no `<N> Degrees` term on the cake header */
  fanAngleDeg: number;
  /** ordered ingredient segments split by `+` */
  segments: CakeSegment[];
}

const LABEL_REGEX = /^\s*\(([a-z])\)\s*/i;
const HTM_REGEX = /(\d+\.?\d*)\s*HTM\b/i;
const DUR_REGEX = /(\d+\.?\d*)\s*DUR\b/i;
const LFT_REGEX = /(\d+\.?\d*)\s*LFT\b/i;
const DLY_REGEX = /(\d+\.?\d*)\s*DLY\b/i;
// Degrees must follow a number; ignore "180 Degrees Fan" vs the bare word.
const DEGREES_REGEX = /(\d+\.?\d*)\s*Degrees?\b/i;

/**
 * Parse a single cake-ingredient text fragment (already split on `+`).
 * Strips `(label)`, `<N> HTM`, `<N> DUR`, `<N> LFT`, `<N> DLY`
 * and returns the residual body.
 */
export function parseCakeSegment(fragment: string): CakeSegment {
  if (!fragment || !fragment.trim()) {
    return {
      label: '', body: '',
      htmOverride: -1, durOverride: -1,
      lftOverride: -1, dlyOverride: -1,
    };
  }
  let body = fragment;

  // Label: leading `(a)`
  let label = '';
  const labelMatch = body.match(LABEL_REGEX);
  if (labelMatch) {
    label = labelMatch[1].toLowerCase();
    body = body.slice(labelMatch[0].length);
  }

  // HTM override
  let htmOverride = -1;
  const htmMatch = body.match(HTM_REGEX);
  if (htmMatch) {
    htmOverride = parseFloat(htmMatch[1]);
    body = body.replace(HTM_REGEX, ' ');
  }

  // DUR override
  let durOverride = -1;
  const durMatch = body.match(DUR_REGEX);
  if (durMatch) {
    durOverride = parseFloat(durMatch[1]);
    body = body.replace(DUR_REGEX, ' ');
  }

  // LFT override — per-segment aerial lift time (seconds).
  let lftOverride = -1;
  const lftMatch = body.match(LFT_REGEX);
  if (lftMatch) {
    lftOverride = parseFloat(lftMatch[1]);
    body = body.replace(LFT_REGEX, ' ');
  }

  // DLY override — per-segment delay before simulation (seconds).
  let dlyOverride = -1;
  const dlyMatch = body.match(DLY_REGEX);
  if (dlyMatch) {
    dlyOverride = parseFloat(dlyMatch[1]);
    body = body.replace(DLY_REGEX, ' ');
  }

  return {
    label,
    body: body.replace(/\s+/g, ' ').trim(),
    htmOverride,
    durOverride,
    lftOverride,
    dlyOverride,
  };
}

/**
 * Parse a full cake VDL string. Splits ingredients on `+` (the canonical
 * Finale separator), extracts per-segment HTM/DUR, and pulls the cake-level
 * fan angle (`<N> Degrees`).
 *
 * The function returns segments only when at least one `+` is present OR
 * a label `(a)` is detected — otherwise the input is not a cake ingredient
 * list and `segments` is empty.
 */
export function parseCakeSegments(raw: string): CakeSegmentParseResult {
  const empty: CakeSegmentParseResult = { fanAngleDeg: -1, segments: [] };
  if (!raw || !raw.trim()) return empty;

  // Cake-level fan angle (header term).
  let fanAngleDeg = -1;
  const degMatch = raw.match(DEGREES_REGEX);
  if (degMatch) fanAngleDeg = parseFloat(degMatch[1]);

  // Cake ingredient lists are everything BEFORE the trailing
  // " N Rows Row ..." block. We split greedily on '+' first; if the user
  // passes the body alone, splitting still works.
  // Strip the rows block so it isn't pulled into the last segment body.
  const rowsCut = raw.search(/\b\d+\s+Rows?\b/i);
  const ingredientArea = rowsCut > 0 ? raw.slice(0, rowsCut) : raw;

  // Only treat as a cake ingredient list if we have a separator or a label.
  const hasPlus = ingredientArea.includes('+');
  const hasLabel = LABEL_REGEX.test(ingredientArea);
  if (!hasPlus && !hasLabel) return { fanAngleDeg, segments: [] };

  // Heuristic: ingredient block starts at the first `(a)` if present;
  // else after the last "Cake" keyword token.
  let start = 0;
  const labelStart = ingredientArea.search(LABEL_REGEX);
  if (labelStart >= 0) {
    start = labelStart;
  } else {
    const cakeIdx = ingredientArea.search(/\bCake\b/i);
    if (cakeIdx >= 0) start = cakeIdx + 'Cake'.length;
  }

  const body = ingredientArea.slice(start).trim();
  if (!body) return { fanAngleDeg, segments: [] };

  const fragments = body.split('+').map((s) => s.trim()).filter(Boolean);
  const segments = fragments.map(parseCakeSegment).filter((s) => s.body.length > 0);

  return { fanAngleDeg, segments };
}
