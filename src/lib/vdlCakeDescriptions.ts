/**
 * VDL Cake Descriptions parser.
 *
 * Splits the standard-syntax cake description into:
 *   - auxiliary (text up to and including the optional "N Shot Ts" header)
 *   - body      (effect segments separated by '+', up to first "Row"/"Rows")
 *   - rowSpecs  (per-row firing descriptions after the first "Row" marker)
 *
 * Firing description grammar (per spec, Table 1):
 *   [delay /] tubeLabels [/ pattern] [/ duration] [*]
 *
 * Number at the very beginning (before first slash) = delay before row.
 * Number not at the beginning = duration of row.
 * Trailing '*' = fires in parallel with previous row.
 *
 * Renderer wiring is a separate round — this module only parses.
 */

export interface FiringDescription {
  /** Delay before this row, ms. -1 if not specified. First row's delay always reads as -1 effectively (caller decides; we keep raw value). */
  delayMs: number;
  /** Duration of this row, ms. -1 if not specified. */
  durationMs: number;
  /** Tube labels left → right (single letters referencing body segments). */
  tubeLabels: string[];
  /** Three-letter firing pattern (STR, STL, FNT, FNR, …) or '' if not specified. */
  pattern: string;
  /** True if row fires in parallel with the previous row ('*' suffix). */
  parallel: boolean;
  /** Original parenthesised text (without parentheses). */
  raw: string;
}

export interface CakeBodyIngredient {
  /** Single-letter label, '' if unlabelled. */
  label: string;
  /** Body description for the ingredient (effect text). */
  body: string;
}

export interface CakeRowSpec {
  /** Row indices this firing description applies to (1-based). */
  rows: number[];
  /** Parsed firing description, or null if row has no parenthesised description. */
  firing: FiringDescription | null;
}

export interface CakeDescription {
  auxiliary: string;
  /** Body text (between auxiliary and first "Row"/"Rows"). */
  body: string;
  /** Body ingredients split by '+'. */
  ingredients: CakeBodyIngredient[];
  /** Declared row count (from "N Rows" before first row spec); 0 if not declared. */
  declaredRowCount: number;
  /** Body-level firing pattern (Z-Shape, W-Shape, …) or '' if not present. */
  bodyFiringPattern: string;
  rowSpecs: CakeRowSpec[];
}

const BODY_FIRING_PATTERN_WORDS = [
  'Z-Shape', 'X-Shape', 'C-Shape', 'V-Shape', 'W-Shape', 'R-Shape',
  'Zipper', 'Bookend', 'Wipe', 'Peacock', 'Angle', 'Fan',
];

/**
 * Detect whether a string looks like a cake description (contains the keyword "Cake").
 */
export function isCakeDescription(input: string): boolean {
  return /\bcake\b/i.test(input);
}

/**
 * Parse a single firing description body (text inside parentheses, no parens).
 */
export function parseFiringDescription(text: string): FiringDescription {
  const raw = text.trim();
  let body = raw;
  const parallel = body.endsWith('*');
  if (parallel) body = body.slice(0, -1).trim();

  const parts = body.split('/').map((p) => p.trim()).filter((p) => p.length > 0);

  let delayMs = -1;
  let durationMs = -1;
  let pattern = '';
  let tubeLabels: string[] = [];

  // Helpers
  const isNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const isPattern = (s: string) => /^[A-Z]{3}$/.test(s);
  const isLabels = (s: string) => /^[A-Za-z]+$/.test(s) && !isPattern(s);

  parts.forEach((part, idx) => {
    if (isNumber(part)) {
      const n = parseFloat(part);
      const ms = Math.round(n * 1000);
      if (idx === 0) delayMs = ms;
      else durationMs = ms;
    } else if (isPattern(part)) {
      pattern = part.toUpperCase();
    } else if (isLabels(part)) {
      tubeLabels = part.split('');
    } else {
      // mixed/unknown: best-effort, treat as labels if lowercase-ish
      tubeLabels = part.split('').filter((c) => /[A-Za-z]/.test(c));
    }
  });

  return { delayMs, durationMs, tubeLabels, pattern, parallel, raw };
}

/**
 * Parse a row specification segment like "Row 1,3,5 (aaaaaaa)" or "Rows 2,4,6 (bbb)".
 * Returns null if the segment doesn't start with Row/Rows.
 */
function parseRowSegment(segment: string): CakeRowSpec | null {
  const m = segment.match(/^\s*Rows?\s+([\d,\s\-]+?)\s*(?:\(([^)]*)\))?\s*$/i);
  if (!m) return null;
  const rows: number[] = [];
  m[1].split(',').forEach((tok) => {
    const t = tok.trim();
    if (!t) return;
    const range = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) rows.push(i);
    } else if (/^\d+$/.test(t)) {
      rows.push(parseInt(t, 10));
    }
  });
  const firing = m[2] != null ? parseFiringDescription(m[2]) : null;
  return { rows, firing };
}

/**
 * Split body text on top-level '+' (ignores '+' inside parentheses).
 */
function splitTopLevelPlus(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '+' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function extractLabel(segment: string): { label: string; body: string } {
  // Match a single-letter parenthesised label anywhere in the segment.
  const m = segment.match(/\(\s*([A-Za-z])\s*\)/);
  if (!m) return { label: '', body: segment.trim() };
  const body = (segment.slice(0, m.index!) + segment.slice(m.index! + m[0].length)).replace(/\s+/g, ' ').trim();
  return { label: m[1].toLowerCase(), body };
}

function detectBodyFiringPattern(text: string): string {
  for (const word of BODY_FIRING_PATTERN_WORDS) {
    const re = new RegExp(`\\b${word.replace('-', '\\-')}\\b`, 'i');
    if (re.test(text)) return word;
  }
  return '';
}

/**
 * Parse a full cake description string into its structured parts.
 */
export function parseCakeDescription(input: string): CakeDescription | null {
  const raw = input.trim();
  if (!raw || !isCakeDescription(raw)) return null;

  // Split on first "Row" / "Rows" keyword. Note: "N Rows" before the first row spec
  // declares row count and belongs to the row-specs side conceptually, but we keep
  // the body up to that "N Rows" marker.
  const rowSplit = raw.match(/\b(\d+\s+Rows?|Rows?)\b/i);
  let auxiliaryAndBody = raw;
  let rowSpecsText = '';
  let declaredRowCount = 0;

  if (rowSplit && rowSplit.index !== undefined) {
    auxiliaryAndBody = raw.slice(0, rowSplit.index).replace(/[,\s]+$/, '');
    rowSpecsText = raw.slice(rowSplit.index);
    const declared = rowSplit[1].match(/^(\d+)\s+Rows?$/i);
    if (declared) {
      declaredRowCount = parseInt(declared[1], 10);
      // Strip the "N Rows," prefix from rowSpecsText, the rest contains "Row 1,3,5 (…)" segments.
      rowSpecsText = rowSpecsText.replace(/^\d+\s+Rows?\s*,?\s*/i, '');
    }
  }

  // Split auxiliary vs body. We treat the body as the portion containing the
  // word "Cake" plus the ingredient list. Heuristic: auxiliary is everything
  // before the first body ingredient label or the "Cake" keyword — whichever
  // comes first — *after* the leading caliber/shot-count header.
  // For now we keep auxiliary as the leading "Ncal N Shot Ts" header (digits/units),
  // and body as the rest up to the row split.
  let auxiliary = '';
  let body = auxiliaryAndBody;
  const headerMatch = auxiliaryAndBody.match(
    /^([\d.]+\s*(?:mm|in|")?\s*)?(\d+\s+Shot\s*)?([\d.]+\s*s\s*)?/i,
  );
  if (headerMatch && headerMatch[0].trim().length > 0) {
    auxiliary = headerMatch[0].trim();
    body = auxiliaryAndBody.slice(headerMatch[0].length).trim();
  }

  const bodyFiringPattern = detectBodyFiringPattern(body);

  // Ingredients (split on top-level '+').
  const ingredients = splitTopLevelPlus(body).map(extractLabel);

  // Row specs: split on commas that precede "Row" / "Rows" tokens.
  // We split by ", Row " boundaries while keeping the "Row" prefix.
  const rowSpecs: CakeRowSpec[] = [];
  if (rowSpecsText) {
    // Insert sentinel before each "Row " occurrence to split cleanly.
    const segments = rowSpecsText
      .split(/,\s*(?=Rows?\b)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const seg of segments) {
      // Some heads start with "Row 1,3,5 (xxx)"; others start with just "Row 1" (no parens).
      const parsed = parseRowSegment(seg);
      if (parsed) rowSpecs.push(parsed);
    }
  }

  return {
    auxiliary,
    body,
    ingredients,
    declaredRowCount,
    bodyFiringPattern,
    rowSpecs,
  };
}
