/**
 * FWsim .fwe Mine extractor — pure, deterministic.
 *
 * Reads a FireworkEffect XML (xsi:type="Mine") and returns a canonical
 * `MineSpec` describing the inner Stars phases (color + count + Color2),
 * tail-link presence, and name-derived semantic flags (color shift,
 * silver tail, comet head).
 *
 * Honest: only XML facts + filename heuristics — no invented numbers.
 */

export interface FweMinePhase {
  /** Primary <Color> of the Stars node (hex, or null when Invisible/unknown). */
  color: string | null;
  /** <Color2> on the same Stars node — used as shift target when isColorShift. */
  color2: string | null;
  /** <Count> on the Stars node (number of stars in this phase). */
  count: number | null;
}

export interface FweMineSpec {
  fileName: string;
  /** All Stars phases in document order. */
  phases: FweMinePhase[];
  /** True when a `CustomTailsLink` node appears (silver/white spark tail). */
  hasTailsLink: boolean;
  /** Filename signals a color shift ("_to_"). XML's `ColorChanging` is unreliable. */
  isColorShift: boolean;
  /** Filename mentions "comet" — dense central jet with elongated tail. */
  hasCometHead: boolean;
  /** Filename mentions "silver_tail" — emphasises the tail link visually. */
  hasSilverTail: boolean;
  /** Resolved primary color (largest-count phase, then filename fallback). */
  primary: string;
  /** Optional secondary color (only when isColorShift). */
  secondary?: string;
}

/** Curated FWsim named-color → hex (covers the 9 mine files). */
const NAMED: Record<string, string | null> = {
  Invisible: null,
  White: '#FFFFFF',
  Silver: '#E5E5E5',
  Red: '#FF1A1A',
  DarkRed: '#B00000',
  Green: '#00E676',
  DarkGreen: '#007A2E',
  Blue: '#3F7BFF',
  DarkBlue: '#1C3A8A',
  Yellow: '#FFD600',
  Orange: '#FF8A00',
  Purple: '#A24BFF',
  Pink: '#FF66C4',
  Magenta: '#FF00C8',
  Cyan: '#33D6FF',
  Aqua: '#33D6FF',
  Gold: '#FFD27A',
  Lemon: '#FFF59A',
  Brocade: '#FFE2AE',
  Spark: '#FFE2AE',
};

const FALLBACK_NAME_TO_HEX: Record<string, string> = {
  red: '#FF1A1A',
  green: '#00E676',
  blue: '#3F7BFF',
  yellow: '#FFD600',
  orange: '#FF8A00',
  purple: '#A24BFF',
  pink: '#FF66C4',
  white: '#FFFFFF',
  silver: '#E5E5E5',
  gold: '#FFD27A',
};

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

function parseColorBlock(block: string): string | null {
  // <Color>Custom</Color> + <CustomR>..</CustomR> sibling case
  const nameMatch = /<Color>([^<]*)<\/Color>/.exec(block);
  const name = nameMatch ? nameMatch[1].trim() : '';
  if (name === 'Custom') {
    const r = /<CustomR>([^<]+)<\/CustomR>/.exec(block);
    const g = /<CustomG>([^<]+)<\/CustomG>/.exec(block);
    const b = /<CustomB>([^<]+)<\/CustomB>/.exec(block);
    if (r && g && b) return `#${hex2(+r[1])}${hex2(+g[1])}${hex2(+b[1])}`;
    return null;
  }
  if (name && name in NAMED) return NAMED[name];
  return null;
}

/** Extract Stars phases via balanced regex on the raw XML (DOMParser-free, Node + jsdom safe). */
function extractStarPhases(xml: string): FweMinePhase[] {
  const phases: FweMinePhase[] = [];
  // Each <BaseEffectNode xsi:type="Stars"> ... </BaseEffectNode>
  // We don't need true balance — Stars nodes nest only inner Children that
  // don't contain another Stars sibling at the same depth in these files.
  const starRe = /<BaseEffectNode\s+xsi:type="Stars">([\s\S]*?)<\/BaseEffectNode>\s*(?=<BaseEffectNode\s+xsi:type="Stars"|<\/Children>|<\/BaseEffectNode>)/g;
  let m: RegExpExecArray | null;
  // Simpler: scan all <... type="Stars"> opening tags and walk forward.
  const opens: number[] = [];
  const openRe = /<BaseEffectNode\s+xsi:type="Stars">/g;
  while ((m = openRe.exec(xml))) opens.push(m.index + m[0].length);
  for (const start of opens) {
    // Match a window of ~6000 chars or until the next opening Stars
    const next = opens.find((s) => s > start) ?? xml.length;
    const window = xml.slice(start, next);
    // Direct-child <Color> ... </Color> at this Stars level: find first balanced one
    const colorBlock = /<Color>[\s\S]*?<\/Color>/.exec(window);
    const color2Block = /<Color2>([\s\S]*?)<\/Color2>/.exec(window);
    const countM = /<Count>([^<]+)<\/Count>/.exec(window);
    // Re-extract direct color block content (between <Color> and </Color>) — guard nested
    let primary: string | null = null;
    if (colorBlock) {
      // The Color element may contain CustomR/G/B siblings. We grabbed up to first </Color>,
      // which closes inner. Walk forward to capture the full direct Color block including siblings up to </Color> at end.
      const fullColorRe = /<Color>\s*(?:<CustomR>[^<]+<\/CustomR>\s*<CustomG>[^<]+<\/CustomG>\s*<CustomB>[^<]+<\/CustomB>\s*<Color>([^<]+)<\/Color>|([^<]+))\s*<\/Color>/;
      const full = fullColorRe.exec(window);
      if (full) {
        const block = full[0];
        primary = parseColorBlock(block);
      }
    }
    let secondary: string | null = null;
    if (color2Block) {
      secondary = parseColorBlock(`<Color>${color2Block[1]}</Color>` + color2Block[1]);
      // Simpler: the inner block already contains a <Color>NAME</Color> tag we can parse directly
      const inner = color2Block[1];
      const innerName = /<Color>([^<]+)<\/Color>/.exec(inner);
      if (innerName) {
        const nm = innerName[1].trim();
        if (nm === 'Custom') {
          const r = /<CustomR>([^<]+)<\/CustomR>/.exec(inner);
          const g = /<CustomG>([^<]+)<\/CustomG>/.exec(inner);
          const b = /<CustomB>([^<]+)<\/CustomB>/.exec(inner);
          secondary = r && g && b ? `#${hex2(+r[1])}${hex2(+g[1])}${hex2(+b[1])}` : null;
        } else if (nm in NAMED) {
          secondary = NAMED[nm];
        } else {
          secondary = null;
        }
      }
    }
    phases.push({
      color: primary,
      color2: secondary,
      count: countM ? Math.round(parseFloat(countM[1])) : null,
    });
  }
  return phases;
}

/** Filename → primary color hex fallback (e.g. "Mine_Silver.fwe" → silver). */
function primaryFromFilename(fileName: string): string | null {
  const low = fileName.toLowerCase().replace(/\.fwe$/, '');
  // Take first known color token after "mine_"
  const tokens = low.split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) {
    if (t in FALLBACK_NAME_TO_HEX) return FALLBACK_NAME_TO_HEX[t];
  }
  return null;
}

/** Public: parse a single `.fwe` Mine XML into a `FweMineSpec`. */
export function extractMineSpecFromXml(xml: string, fileName: string): FweMineSpec {
  const phases = extractStarPhases(xml);
  const hasTailsLink = /xsi:type="CustomTailsLink"/.test(xml);
  const low = fileName.toLowerCase();
  const isColorShift = /_to_/.test(low);
  const hasCometHead = /comet/.test(low);
  const hasSilverTail = /silver_tail/.test(low);
  // Pick the inner / largest-count phase for primary
  const ranked = [...phases].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  let primary = ranked.find((p) => !!p.color)?.color ?? null;
  // Filename label wins for single-solid mines (e.g. "Mine_Silver.fwe" — author intent
  // overrides FWsim's internal RGB which is often a non-canonical brown/spark hue).
  const filenamePrimary = primaryFromFilename(fileName);
  const isSingleSolid = filenamePrimary && !/_to_|_w_|comet/i.test(low);
  if (isSingleSolid) primary = filenamePrimary;
  if (!primary) primary = filenamePrimary;
  if (!primary) primary = '#FFFFFF';
  let secondary: string | undefined;
  if (isColorShift) {
    // Shift target = filename second color OR Color2 of inner phase
    const after = low.split('_to_')[1] ?? '';
    const tok = after.split(/[^a-z]+/).find((t) => t in FALLBACK_NAME_TO_HEX);
    if (tok) secondary = FALLBACK_NAME_TO_HEX[tok];
    else secondary = ranked.find((p) => !!p.color2)?.color2 ?? undefined;
  }
  return {
    fileName,
    phases,
    hasTailsLink,
    isColorShift,
    hasCometHead,
    hasSilverTail,
    primary,
    secondary,
  };
}
