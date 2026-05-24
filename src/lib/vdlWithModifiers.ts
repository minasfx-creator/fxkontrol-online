/**
 * VDL `With` modifiers parser.
 *
 * Spec: see docs/reference/vdl-and-plus-ampersand-with.md
 *
 * `With <…>` (and the alias `w/ <…>`) clauses attach an extra component
 * to an effect: a mine, a petal (shaped burst), a tail-style modifier,
 * or simply mixed-in stars of a color/description.
 *
 * Pistil clauses (`with <color> pistil`) are intentionally NOT returned
 * here — `vdlParser` already routes them to `hasPistil`/`pistilColor`
 * and we don't want to double-account for them.
 */

export type WithModifierKind =
  | 'mine'
  | 'bouquet'
  | 'petal'
  | 'tail'
  | 'mixedStars';

export interface WithModifier {
  kind: WithModifierKind;
  shape?: string;      // for petal: ring / palm / crown / peony / …
  color?: string;      // hex (#RRGGBB) if a known color was found
  colorName?: string;  // canonical lowercase name
  raw: string;         // original clause text (trimmed)
}

const MINE_WORDS = ['mine', 'bouquet'] as const;

const PETAL_WORDS = [
  'ring', 'palm', 'crown', 'peony', 'dahlia', 'chrysanthemum',
  'willow', 'kamuro', 'horsetail', 'crossette', 'brocade',
  'spider', 'flower',
] as const;

const TAIL_WORDS = [
  'tail', 'glitter', 'strobe', 'crackle', 'crackling',
  'twinkle', 'flicker',
] as const;

/**
 * Parse all `with …` / `w/ …` clauses out of a VDL string.
 *
 * Splits on `+`, `&`, comma, or end-of-string so each clause stays scoped
 * to its own component and doesn't bleed into the next ingredient.
 *
 * @param raw         original VDL text
 * @param colorTable  optional lookup of color-name → hex. Pass the parser's
 *                    VDL_COLORS_TABLE for full coverage; falls back to an
 *                    internal mini-table for standalone use / tests.
 */
export function parseWithModifiers(
  raw: string,
  colorTable: Record<string, { hex: string }> = DEFAULT_COLOR_TABLE,
): WithModifier[] {
  if (!raw) return [];
  const out: WithModifier[] = [];

  // Greedy non-overlapping: lookahead stops at next connector or EOS.
  const re = /\b(?:with|w\/)\s+([^+&,]+?)(?=\s*(?:[+&,]|$))/gi;
  const colorNames = Object.keys(colorTable).sort((a, b) => b.length - a.length);

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const phrase = m[1].trim();
    if (!phrase) continue;
    // Pistil clauses are owned by the parser's pistil branch.
    if (/\bpistil\b/i.test(phrase)) continue;

    const lower = phrase.toLowerCase();

    // Color (greedy on length so "sky blue" beats "blue", etc.)
    let color: string | undefined;
    let colorName: string | undefined;
    for (const name of colorNames) {
      const re2 = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
      if (re2.test(lower)) {
        color = colorTable[name].hex;
        colorName = name;
        break;
      }
    }

    // Kind classification — order matters: mine > petal > tail > mixed.
    let kind: WithModifierKind = 'mixedStars';
    let shape: string | undefined;

    for (const w of MINE_WORDS) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
        kind = w === 'bouquet' ? 'bouquet' : 'mine';
        break;
      }
    }
    if (kind === 'mixedStars') {
      for (const w of PETAL_WORDS) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
          kind = 'petal';
          shape = w;
          break;
        }
      }
    }
    if (kind === 'mixedStars') {
      for (const w of TAIL_WORDS) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
          kind = 'tail';
          break;
        }
      }
    }

    out.push({ kind, shape, color, colorName, raw: phrase });
  }

  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Minimal fallback so this module is testable without importing the parser.
const DEFAULT_COLOR_TABLE: Record<string, { hex: string }> = {
  red: { hex: '#f21919' },
  blue: { hex: '#4c66ff' },
  green: { hex: '#26b21c' },
  gold: { hex: '#504605' },
  silver: { hex: '#4b4b55' },
  white: { hex: '#bfbfd8' },
  yellow: { hex: '#ccb20c' },
  purple: { hex: '#bf3fff' },
  orange: { hex: '#e56619' },
  pink: { hex: '#d859bf' },
  cyan: { hex: '#51a3cc' },
  'sky blue': { hex: '#337fcc' },
};
