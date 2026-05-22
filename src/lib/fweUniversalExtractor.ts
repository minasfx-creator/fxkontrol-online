/**
 * fweUniversalExtractor — TS mirror of `scripts/parse-standard-effects.py`.
 *
 * Pure regex extraction (no DOMParser) so it runs in Node tests and in the
 * browser. Used at runtime when the editor needs to inspect a `.fwe` that
 * isn't pre-bundled in `generated/standardEffects.json`.
 *
 * Honest: only XML facts + filename hints — no invented numbers.
 */

export interface FweColorPhase {
  at: number;
  hex: string;
  modifier?: 'strobe' | 'crackle' | 'glitter' | 'charcoal';
}

export interface FweUniversalSpec {
  fileName: string;
  rootType: string | null;
  typeReal: string | null;
  distribution: string | null;
  palette: string[];
  primary: string | null;
  secondary: string | null;
  colorPhases: FweColorPhase[];
  tailRef: string | null;
  hasPistil: boolean;
  hasTailsLink: boolean;
  hasCrackling: boolean;
  subShellCount: number;
  caliberIn: number | null;
  caliberSource: 'xml' | 'inferred' | 'unknown';
  bengalDurationS: number | null;
}

const NAMED: Record<string, string | null> = {
  PastelRed: '#FF6B6B', Red: '#FF1A1A', DarkRed: '#B00000',
  PastelGreen: '#7CFFB0', Green: '#00E676', DarkGreen: '#007A2E',
  PastelBlue: '#7DB6FF', Blue: '#3F7BFF', DarkBlue: '#1C3A8A',
  Yellow: '#FFD600', Orange: '#FF8A00', Pink: '#FF66C4',
  PastelPink: '#FFC0DA', PastelPurple: '#D5B8FF',
  Purple: '#A24BFF', Magenta: '#FF00C8', Cyan: '#33D6FF',
  Aqua: '#33D6FF', Mint: '#A2FFD6', Lime: '#B6FF3F',
  White: '#FFFFFF', Silver: '#E5E5E5', Gold: '#FFD27A',
  Spark: '#FFE2AE', Brocade: '#FFE2AE', Lemon: '#FFF59A',
  Invisible: null,
};

const KNOWN_ROOTS = new Set([
  'Shell', 'Mine', 'Cake', 'Bengal', 'RomanCandle', 'Fountain',
  'Rocket', 'Crossette', 'Farfalle', 'Whistle', 'Eruption',
  'Tourbillon', 'Lancework', 'GroundShellFlash', 'Sun',
]);

const EXTENDED_SUBTYPES = ['Vulcano', 'PhotoFlash', 'FlameJet', 'Lycopodium', 'Sparkler', 'Nautical', 'FrontPiece'];
const SHELL_SUBTYPES = ['Crossette', 'Farfalle', 'Whistle', 'Tourbillon'];

const CALIBER_TOKENS: Array<[RegExp, number]> = [
  [/\(\s*xsmall\s*\)|\bxsmall\b/i, 0.8],
  [/\(\s*small\s*\)|\bsmall\b/i, 1.5],
  [/\(\s*medium\s*\)|\bmedium\b/i, 2.5],
  [/\(\s*big\s*\)|\bbig\b|\blarge\b/i, 4.0],
];

const PHASE_COLORS: Record<string, string> = {
  red: '#FF1A1A', green: '#00E676', blue: '#3F7BFF', yellow: '#FFD600',
  orange: '#FF8A00', pink: '#FF66C4', purple: '#A24BFF', white: '#FFFFFF',
  silver: '#E5E5E5', gold: '#FFD27A', aqua: '#33D6FF', mint: '#A2FFD6',
  magenta: '#FF00C8', cyan: '#33D6FF', brocade: '#FFE2AE', titanium: '#F5F5F5',
  'coal gold': '#9C7A1C', 'charcoal gold': '#7A6818',
  'silver charcoal': '#8C8C8C', 'gold charcoal': '#8A6E1A',
  'pastel red': '#FF6B6B', 'pastel green': '#7CFFB0',
  'pastel blue': '#7DB6FF', 'pastel purple': '#D5B8FF',
};

function parseColorPhases(stem: string): FweColorPhase[] {
  const s = stem.toLowerCase();
  let mod: FweColorPhase['modifier'] | undefined;
  if (/strobe/.test(s)) mod = 'strobe';
  else if (/crackl/.test(s)) mod = 'crackle';
  else if (/glitter/.test(s)) mod = 'glitter';
  else if (/charcoal/.test(s)) mod = 'charcoal';
  const m = /\b([a-z][a-z ]{1,18}?)\s+to\s+([a-z][a-z ]{1,18}?)(?=\s|$|[.,)\]\[])/.exec(s);
  if (!m) return [];
  const a = m[1].trim();
  const b = m[2].trim();
  const lookup = (t: string): string | null => {
    if (PHASE_COLORS[t]) return PHASE_COLORS[t];
    for (const k of Object.keys(PHASE_COLORS)) if (t.endsWith(k)) return PHASE_COLORS[k];
    return null;
  };
  const ha = lookup(a);
  const hb = lookup(b);
  if (!ha || !hb) return [];
  return [
    { at: 0, hex: ha },
    { at: 1, hex: hb, ...(mod ? { modifier: mod } : {}) },
  ];
}

function parseTailRef(stem: string): string | null {
  const m = /\[([^\]]+)\]/.exec(stem);
  if (!m) return null;
  const inner = m[1].trim();
  return inner.toLowerCase() === 'none' ? 'none' : inner;
}

function inferCaliberFromName(stem: string): number | null {
  for (const [re, val] of CALIBER_TOKENS) if (re.test(stem)) return val;
  return null;
}

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

export function extractFweUniversal(xml: string, fileName: string): FweUniversalSpec {
  // root type — first xsi:type from KNOWN_ROOTS, else first xsi:type
  let rootType: string | null = null;
  let distribution: string | null = null;
  const typeRe = /xsi:type="([A-Za-z]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = typeRe.exec(xml))) {
    const t = m[1];
    if (rootType == null && KNOWN_ROOTS.has(t)) rootType = t;
    if (distribution == null && t.endsWith('Distribution')) distribution = t.slice(0, -'Distribution'.length);
    if (rootType && distribution) break;
  }
  if (rootType == null) {
    const f = /xsi:type="([A-Za-z]+)"/.exec(xml);
    rootType = f ? f[1] : null;
  }

  // palette: <Color>NAME</Color> + Custom RGB siblings
  const palette: string[] = [];
  const namedRe = /<Color>([A-Za-z]+)<\/Color>/g;
  while ((m = namedRe.exec(xml))) {
    const name = m[1];
    if (name === 'Custom' || name === 'true' || name === 'false') continue;
    const hx = NAMED[name];
    if (hx && !palette.includes(hx) && palette.length < 8) palette.push(hx);
  }
  const customRe = /<CustomR>([^<]+)<\/CustomR>\s*<CustomG>([^<]+)<\/CustomG>\s*<CustomB>([^<]+)<\/CustomB>/g;
  while ((m = customRe.exec(xml))) {
    const hx = `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`;
    if (!palette.includes(hx) && palette.length < 8) palette.push(hx);
  }

  // caliber: max <Diameter> ÷ 0.0254
  const diaRe = /<Diameter>([^<]+)<\/Diameter>/g;
  let maxDia = 0;
  while ((m = diaRe.exec(xml))) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > maxDia) maxDia = v;
  }
  const caliberIn = maxDia > 0 ? Math.round((maxDia / 0.0254) * 10) / 10 : null;

  const hasPistil = /<Name>Pistil<\/Name>|[Pp]istil/.test(xml);
  const hasTailsLink = /xsi:type="CustomTailsLink"/.test(xml);
  const hasCrackling = /xsi:type="(Crackling|CustomCracklingLink)"/.test(xml);
  const subShellCount = (xml.match(/xsi:type="SubShells"/g) ?? []).length;

  let bengalDurationS: number | null = null;
  if (rootType === 'Bengal') {
    const bm = /\(\s*0*(\d{1,3})\s*s\s*\)/i.exec(fileName);
    bengalDurationS = bm ? parseInt(bm[1], 10) : null;
  }

  return {
    fileName,
    rootType,
    distribution,
    palette,
    primary: palette[0] ?? null,
    secondary: palette[1] ?? null,
    hasPistil,
    hasTailsLink,
    hasCrackling,
    subShellCount,
    caliberIn,
    bengalDurationS,
  };
}
