/**
 * colorResolver — single, idempotent resolution of an effect color description
 * (name, hex, "Verde Cintilante", PT-BR aliases) into a stable hex + canonical
 * VDL palette match.
 *
 * Pipeline:
 *   1. If input is `#rrggbb` → parse RGB and quantise via `rgbToNearestVdl`.
 *   2. If input matches a name (EN or PT-BR alias) → use the alias's RGB and
 *      then quantise to the canonical VDL palette to guarantee the same hex
 *      regardless of where the name came from.
 *   3. Fallback: `#fff2c4` (warm cream), source = `'fallback'`.
 *
 * Why route everything through `rgbToNearestVdl`?
 *   - The Effect renderer assumes hex colors collapse to VDL palette entries
 *     (mem://render/vdl-color-resolver-actual). Using palette hex makes the
 *     bucketing inside `effectFingerprint` deterministic across importers.
 *   - When a canonical `vdlColorPipeline` lands, swap one import — the API
 *     stays the same.
 */

import { rgbToNearestVdl, VDL_PALETTE } from '@/lib/vdlQuantizer';

export interface ResolvedColor {
  /** Hex from the canonical VDL palette (or fallback). */
  hex: string;
  /** Canonical VDL palette name (e.g. "Red", "Gold"). */
  vdl: string;
  /** Where the input matched. */
  source: 'hex' | 'name' | 'fallback';
}

const FALLBACK: ResolvedColor = { hex: '#fff2c4', vdl: 'White', source: 'fallback' };

// PT-BR + EN name → approximate sRGB triplet (0..255). The triplet is
// quantised into a real VDL palette entry, so these are *seeds*, not outputs.
const NAME_RGB: Record<string, [number, number, number]> = {
  // English
  red: [242, 25, 25], green: [38, 178, 28], blue: [76, 102, 255],
  white: [191, 191, 216], silver: [216, 226, 232], gold: [255, 210, 122],
  yellow: [255, 226, 74], orange: [229, 102, 25], purple: [191, 63, 255],
  pink: [216, 89, 191], cyan: [81, 163, 204], magenta: [204, 25, 255],
  lemon: [191, 153, 12], aqua: [51, 127, 204], brocade: [255, 217, 163],
  ruby: [242, 25, 76], lavender: [160, 63, 255], turquoise: [40, 163, 204],
  violet: [204, 102, 255], indigo: [127, 63, 255], plum: [178, 25, 127],
  peach: [204, 127, 25], lime: [89, 178, 28], fuchsia: [216, 89, 229],
  // Portuguese aliases (Magic + Amazon use these)
  vermelho: [242, 25, 25], verde: [38, 178, 28], azul: [76, 102, 255],
  branco: [191, 191, 216], prateado: [216, 226, 232], dourado: [255, 210, 122],
  amarelo: [255, 226, 74], laranja: [229, 102, 25], roxo: [191, 63, 255],
  rosa: [216, 89, 191], ciano: [81, 163, 204],
};

function parseHex(input: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const m3 = /^#?([0-9a-f]{3})$/i.exec(input.trim());
  if (m3) {
    const r = parseInt(m3[1][0] + m3[1][0], 16);
    const g = parseInt(m3[1][1] + m3[1][1], 16);
    const b = parseInt(m3[1][2] + m3[1][2], 16);
    return [r, g, b];
  }
  return null;
}

function findNameRgb(raw: string): [number, number, number] | null {
  const lower = raw.toLowerCase().trim();
  // Direct hit
  if (NAME_RGB[lower]) return NAME_RGB[lower];
  // First known token (handles "Verde Cintilante", "Gold No Trail", etc.)
  for (const token of lower.split(/[\s/,;\-]+/)) {
    if (NAME_RGB[token]) return NAME_RGB[token];
    // Also accept canonical VDL palette names (case-insensitive)
    const vdl = VDL_PALETTE.find(v => v.name.toLowerCase() === token);
    if (vdl) return [Math.round(vdl.r * 255), Math.round(vdl.g * 255), Math.round(vdl.b * 255)];
  }
  return null;
}

export function resolveEffectColor(raw: string | null | undefined): ResolvedColor {
  if (!raw) return FALLBACK;
  // 1. Hex literal
  const hex = parseHex(raw);
  if (hex) {
    const m = rgbToNearestVdl(hex[0], hex[1], hex[2]);
    return { hex: m.hex, vdl: m.name, source: 'hex' };
  }
  // 2. Name / alias
  const named = findNameRgb(raw);
  if (named) {
    const m = rgbToNearestVdl(named[0], named[1], named[2]);
    return { hex: m.hex, vdl: m.name, source: 'name' };
  }
  return FALLBACK;
}

/** Convenience for callers that only care about the hex (idempotent). */
export function resolveEffectColorHex(raw: string | null | undefined): string {
  return resolveEffectColor(raw).hex;
}
