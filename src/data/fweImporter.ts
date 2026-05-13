/**
 * ─── FWsim .fwe runtime importer ──────────────────────────────────
 * Parses a `<FireworkEffect>` XML payload (FWsim Pro format) and
 * produces a canonical `Effect` ready to drop on the timeline.
 *
 * Strategy (intentionally tolerant — the .fwe schema is huge):
 *   1. Detect root kind via the first <BaseEffectNode xsi:type="..."/>
 *      under <Children>. Fallback: 'Shell'.
 *   2. Pick the first Stars/StarTails <Color> block as dominant color.
 *      If <Color>Custom</Color> + CustomR/G/B → RGB. Otherwise map
 *      named colors via NAMED_COLOR_MAP.
 *   3. Optionally pick a secondary color (second distinct Color block).
 *   4. Duration: max <Life> + <LifeSigma> across StarTails, with a
 *      filename override pattern ("_NN_Shots_I_Ns" cake convention).
 *   5. Shot count for cakes: from filename "(NN_Shots)" or count of
 *      direct <Shell> children inside <Cake><Children>.
 *
 * No DOM dependencies beyond `DOMParser` (browser + jsdom both OK).
 */

import type { Effect, PartType } from '@/data/effectLibrary';
import {
  type FweRootKind,
  type FweUploadedSpec,
  fweEffectId,
  fweSpecToEffect,
} from '@/data/fweUploadedEffects';

/** FWsim named-color → hex (subset matching the user fixtures). */
const NAMED_COLOR_MAP: Record<string, string> = {
  Red: '#FF1A1A',
  Green: '#1AD455',
  Blue: '#1A6CFF',
  White: '#F5F5F5',
  Yellow: '#FFE34A',
  Orange: '#FF8A1A',
  Purple: '#9B30FF',
  Pink: '#FF69B4',
  Cyan: '#00E5FF',
  Magenta: '#FF1AB8',
  Spark: '#FFD27A',
  PastelGreen: '#9CE6A0',
  PastelOrange: '#FFC080',
  PastelBlue: '#9CC4FF',
  PastelRed: '#FF9C9C',
  PastelYellow: '#FFF59C',
  PastelPink: '#FFB8D6',
  PastelPurple: '#C19CFF',
  Custom: '#FFFFFF', // resolved later via RGB block
};

const ROOT_KIND_MAP: Record<string, FweRootKind> = {
  Cake: 'Cake',
  Shell: 'Shell',
  Mine: 'Mine',
};

const ROOT_TO_PART_TYPE: Record<FweRootKind, PartType> = {
  Cake: 'cake',
  Shell: 'shell',
  Mine: 'mine',
};

const ROOT_TO_CATEGORY: Record<FweRootKind, FweUploadedSpec['category']> = {
  Cake: 'cakes_batteries',
  Shell: 'morteiros',
  Mine: 'mines',
};

const ROOT_TO_ICON: Record<FweRootKind, string> = {
  Cake: '🎂',
  Shell: '💥',
  Mine: '☄️',
};

export interface FweImportResult {
  ok: boolean;
  effect?: Effect;
  spec?: FweUploadedSpec;
  warnings: string[];
  errors: string[];
}

/** Sanitize a filename → display title (drop ext, normalise separators). */
function fileNameToTitle(fileName: string): string {
  return fileName
    .replace(/\.fwe$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rgb255ToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/**
 * Extract dominant + secondary color from the first Stars/StarTails
 * <Color> blocks in document order.
 */
function extractColors(root: Element): { primary: string; secondary?: string } {
  const colorNodes = Array.from(root.getElementsByTagName('Color')).filter((n) => {
    // Must contain CustomR/G/B + Color child elements (not the
    // attribute-only <Color>NAME</Color> form).
    return n.getElementsByTagName('Color').length > 0;
  });
  const seen: string[] = [];
  for (const c of colorNodes) {
    const name = c.getElementsByTagName('Color')[0]?.textContent?.trim();
    if (!name) continue;
    let hex = NAMED_COLOR_MAP[name] ?? '#FFFFFF';
    if (name === 'Custom') {
      const r = Number(c.getElementsByTagName('CustomR')[0]?.textContent ?? '0');
      const g = Number(c.getElementsByTagName('CustomG')[0]?.textContent ?? '0');
      const b = Number(c.getElementsByTagName('CustomB')[0]?.textContent ?? '0');
      // Pure black customs are placeholders for "use named" — skip.
      if (r === 0 && g === 0 && b === 0) continue;
      hex = rgb255ToHex(r, g, b);
    }
    if (!seen.includes(hex)) seen.push(hex);
    if (seen.length >= 2) break;
  }
  return { primary: seen[0] ?? '#FFD27A', secondary: seen[1] };
}

/**
 * Compute duration from StarTails Life + LifeSigma, falling back to
 * a filename hint ("_3s" / "_18s") and a sensible default per kind.
 */
function extractDuration(root: Element, kind: FweRootKind, fileName: string): number {
  const tails = Array.from(root.getElementsByTagName('StarTails'));
  let maxLife = 0;
  for (const t of tails) {
    const life = Number(t.getElementsByTagName('Life')[0]?.textContent ?? '0');
    const sigma = Number(t.getElementsByTagName('LifeSigma')[0]?.textContent ?? '0');
    const total = life + sigma;
    if (Number.isFinite(total) && total > maxLife) maxLife = total;
  }
  const fileHint = /[_-](\d+(?:\.\d+)?)s(?:[._-]|$)/i.exec(fileName);
  if (fileHint) {
    const v = Number(fileHint[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  if (maxLife > 0) return Math.round(maxLife * 10) / 10;
  return kind === 'Cake' ? 12 : kind === 'Shell' ? 4 : 2;
}

/** Cake shot count: filename hint "_NN_Shots_" or direct Shell children. */
function extractShotCount(root: Element, fileName: string): number | undefined {
  const m = /[_-](\d+)[_-]?Shots?/i.exec(fileName);
  if (m) return Number(m[1]);
  const cake = root.getElementsByTagName('BaseEffectNode')[0];
  if (!cake) return undefined;
  const direct = Array.from(cake.children).find((c) => c.tagName === 'Children');
  if (!direct) return undefined;
  const shells = Array.from(direct.children).filter((c) => {
    if (c.tagName !== 'BaseEffectNode') return false;
    const t = c.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type') ||
      c.getAttribute('xsi:type');
    return t === 'Shell';
  });
  return shells.length > 0 ? shells.length : undefined;
}

function detectRootKind(root: Element): FweRootKind {
  const first = root.getElementsByTagName('BaseEffectNode')[0];
  if (!first) return 'Shell';
  const xsi =
    first.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type') ||
    first.getAttribute('xsi:type') ||
    '';
  return ROOT_KIND_MAP[xsi] ?? 'Shell';
}

/** Heuristic pattern from filename keywords. */
function patternFromName(name: string): string | undefined {
  // Underscores are word-chars in JS regex, so normalise to spaces
  // before applying \b boundaries.
  const n = name.toLowerCase().replace(/[_\-.]+/g, ' ');
  if (/\bcrown\b|\bbrocade\b|\bkamuro\b/.test(n)) return 'kamuro';
  if (/\bchrysanthemum\b/.test(n)) return 'chrysanthemum';
  if (/\bpeony\b/.test(n)) return 'peony';
  if (/\bwillow\b/.test(n)) return 'willow';
  if (/\bring\b/.test(n)) return 'ring';
  if (/\bheart\b/.test(n)) return 'heart';
  if (/\bcomet\b|\bmine\b/.test(n)) return 'comet';
  if (/\bpalm\b/.test(n)) return 'palm';
  return undefined;
}

/**
 * Parse a raw .fwe XML string into an importable spec + Effect.
 * Pass `fileName` (without extension) so timeline ids stay stable
 * across re-imports.
 */
export function parseFweXml(xml: string, fileName: string): FweImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!xml || !xml.trim()) {
    errors.push('Empty XML payload.');
    return { ok: false, warnings, errors };
  }
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    errors.push(`DOMParser failure: ${(e as Error).message}`);
    return { ok: false, warnings, errors };
  }
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    errors.push('Malformed XML — missing FireworkEffect root.');
    return { ok: false, warnings, errors };
  }
  const root = doc.getElementsByTagName('FireworkEffect')[0];
  if (!root) {
    errors.push('Missing <FireworkEffect> root element.');
    return { ok: false, warnings, errors };
  }

  const kind = detectRootKind(root);
  const colors = extractColors(root);
  const duration = extractDuration(root, kind, fileName);
  const shotCount = kind === 'Cake' ? extractShotCount(root, fileName) : undefined;
  if (kind === 'Cake' && !shotCount) {
    warnings.push('Cake detected but shot-count not derivable from XML or filename.');
  }
  const pattern = patternFromName(fileName);

  // Sensible per-kind defaults; same heuristics as the curated catalog.
  const caliber = kind === 'Shell' ? 5 : kind === 'Mine' ? 3 : 2;
  const heightMeters = kind === 'Shell' ? 100 : kind === 'Mine' ? 35 : 45;
  const prefire = kind === 'Shell' ? 2.5 : kind === 'Mine' ? 0.4 : 0.8;
  const cost = Math.max(12, Math.round(duration * 6 + caliber * 4));

  const spec: FweUploadedSpec = {
    fileName: fileName.replace(/\.fwe$/i, ''),
    rootKind: kind,
    category: ROOT_TO_CATEGORY[kind],
    partType: ROOT_TO_PART_TYPE[kind],
    displayName: fileNameToTitle(fileName),
    color: colors.primary,
    secondaryColor: colors.secondary,
    pattern,
    duration,
    caliber,
    heightMeters,
    prefire,
    shotCount,
    cost,
    icon: ROOT_TO_ICON[kind],
    impliesTrail: root.getElementsByTagName('StarTails').length > 0,
  };

  const effect = fweSpecToEffect(spec);
  return { ok: true, spec, effect, warnings, errors };
}

/** Re-export id derivation so callers can dedupe. */
export { fweEffectId };
