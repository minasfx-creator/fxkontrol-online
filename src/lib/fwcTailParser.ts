/**
 * fwcTailParser — TS mirror of `scripts/parse-fwc-components.py`.
 *
 * Pure regex extraction (no DOMParser) so it runs in Node tests and the browser.
 * Used at runtime when the editor needs to inspect a `.fwc` not pre-bundled in
 * `generated/tailComponents.json`.
 *
 * Honest: only XML facts + filename heuristics — no invented numbers.
 */

export type FwcTailKind =
  | 'brocade' | 'silver' | 'gold' | 'glitter' | 'crackling' | 'spider' | 'polyp'
  | 'microstarStrobe' | 'mortarSparks' | 'explosionSparks' | 'snowballs'
  | 'poppingFlowers' | 'crissCross' | 'cracklingPearls' | 'dragonEggs' | 'none';

export type FwcTailLength = 'short' | 'medium' | 'long' | 'thin' | 'thick' | 'wide';
export type FwcTailSize = 'large' | 'medium' | 'small';

export interface FwcTailSpec {
  fileName: string;
  displayName: string;
  kind: FwcTailKind;
  color: string[];
  density: number | null;
  width: number | null;
  life: number | null;
  length: FwcTailLength | null;
  size: FwcTailSize | null;
  strobe: boolean;
  strobeFreqHz: number | null;
}

const KIND_RULES: Array<[RegExp, FwcTailKind]> = [
  [/criss[- ]cross/i, 'crissCross'],
  [/crackling pearls?/i, 'cracklingPearls'],
  [/popping flowers?/i, 'poppingFlowers'],
  [/dragon eggs?/i, 'dragonEggs'],
  [/snowballs?/i, 'snowballs'],
  [/mortar sparks?/i, 'mortarSparks'],
  [/explosion sparks?/i, 'explosionSparks'],
  [/gold spider/i, 'spider'],
  [/\bpolyp\b/i, 'polyp'],
  [/microstars?_?\s*\w*\s*strobe/i, 'microstarStrobe'],
  [/\bglitter\b/i, 'glitter'],
  [/\bcrackling\b/i, 'crackling'],
  [/\bspider\b/i, 'spider'],
  [/\bbrocade\b/i, 'brocade'],
  [/\bgold\b/i, 'gold'],
  [/\bsilver\b/i, 'silver'],
];

const LENGTH_RULES: Array<[RegExp, FwcTailLength]> = [
  [/\blong\b/i, 'long'], [/\bshort\b/i, 'short'],
  [/\bmedium\b/i, 'medium'], [/\bthin\b/i, 'thin'],
  [/\bthick\b/i, 'thick'], [/\bwide\b/i, 'wide'],
];

const SIZE_RULES: Array<[RegExp, FwcTailSize]> = [
  [/\(\s*large\s*\)/i, 'large'],
  [/\(\s*medium\s*\)/i, 'medium'],
  [/\(\s*small\s*\)/i, 'small'],
];

const NAMED: Record<string, string> = {
  Red: '#FF1A1A', Green: '#00E676', Blue: '#3F7BFF', Yellow: '#FFD600',
  Orange: '#FF8A00', Pink: '#FF66C4', Purple: '#A24BFF', White: '#FFFFFF',
  Silver: '#E5E5E5', Gold: '#FFD27A', Brocade: '#FFE2AE', Aqua: '#33D6FF',
  Mint: '#A2FFD6',
};

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

function detectKind(s: string): FwcTailKind {
  for (const [re, k] of KIND_RULES) if (re.test(s)) return k;
  return 'none';
}

function detectLength(s: string): FwcTailLength | null {
  for (const [re, k] of LENGTH_RULES) if (re.test(s)) return k;
  return null;
}

function detectSize(s: string): FwcTailSize | null {
  for (const [re, k] of SIZE_RULES) if (re.test(s)) return k;
  return null;
}

export function parseFwcTail(xml: string, fileName: string): FwcTailSpec {
  const stem = fileName.replace(/\.fwc$/i, '');
  const palette: string[] = [];

  const namedRe = /<Color>([A-Za-z]+)<\/Color>/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(xml))) {
    const hx = NAMED[m[1]];
    if (hx && !palette.includes(hx) && palette.length < 4) palette.push(hx);
  }
  const customRe = /<CustomR>([^<]+)<\/CustomR>\s*<CustomG>([^<]+)<\/CustomG>\s*<CustomB>([^<]+)<\/CustomB>/g;
  while ((m = customRe.exec(xml))) {
    const hx = `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`;
    if (!palette.includes(hx) && palette.length < 4) palette.push(hx);
  }

  const densities = Array.from(xml.matchAll(/<Density>([^<]+)<\/Density>/g)).map(x => +x[1]).filter(Number.isFinite);
  const widths = Array.from(xml.matchAll(/<Width>([^<]+)<\/Width>/g)).map(x => +x[1]).filter(Number.isFinite);
  const lives = Array.from(xml.matchAll(/<Life>([^<]+)<\/Life>/g)).map(x => +x[1]).filter(Number.isFinite);
  const strobeFreqs = Array.from(xml.matchAll(/<StrobeFreqMean>([^<]+)<\/StrobeFreqMean>/g)).map(x => +x[1]).filter(Number.isFinite);
  const strobe = /<Strobe>true<\/Strobe>/i.test(xml);

  return {
    fileName,
    displayName: stem,
    kind: detectKind(stem),
    color: palette,
    density: densities.length ? Math.max(...densities) : null,
    width: widths.length ? Math.max(...widths) : null,
    life: lives.length ? Math.max(...lives) : null,
    length: detectLength(stem),
    size: detectSize(stem),
    strobe,
    strobeFreqHz: strobeFreqs.length ? Math.max(...strobeFreqs) : null,
  };
}
