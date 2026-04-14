/**
 * ═══════════════════════════════════════════════════════════════════════
 * VDL Euclidean Quantizer — RGB → Nearest Finale 3D VDL Color
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Maps arbitrary RGB values (0-255 integer or 0-1 float) to the closest
 * canonical VDL color using Euclidean distance in normalized RGB space.
 *
 * Used by the VVIZ export pipeline to ensure color fidelity when
 * transferring coreographies to Finale 3D.
 */

export interface VdlMatch {
  name: string;       // e.g. "Gold"
  hex: string;        // e.g. "#504605"
  impliesTrail: boolean;
  distance: number;   // Euclidean distance (lower = better match)
}

// ── Canonical 25 VDL Colors (normalized 0-1 RGB from Finale 3D spec) ──
// Only base colors — "Tip" variants share the same RGB but suppress trail.

interface VdlEntry { name: string; hex: string; r: number; g: number; b: number; impliesTrail: boolean }

const VDL_PALETTE: VdlEntry[] = [
  { name: 'Aqua',         hex: '#337fcc', r: 0.20, g: 0.50, b: 0.80, impliesTrail: false },
  { name: 'Blue',         hex: '#4c66ff', r: 0.30, g: 0.40, b: 1.15, impliesTrail: false },
  { name: 'Charcoal',     hex: '#5a280a', r: 0.90, g: 0.40, b: 0.10, impliesTrail: true },
  { name: 'Cyan',         hex: '#51a3cc', r: 0.32, g: 0.64, b: 0.80, impliesTrail: false },
  { name: 'Dark',         hex: '#000000', r: 0.00, g: 0.00, b: 0.00, impliesTrail: false },
  { name: 'Fresh Yellow', hex: '#b29959', r: 0.70, g: 0.60, b: 0.35, impliesTrail: false },
  { name: 'Fuchsia',      hex: '#d859e5', r: 0.85, g: 0.35, b: 0.90, impliesTrail: false },
  { name: 'Gamboge',      hex: '#ff9959', r: 1.00, g: 0.35, b: 0.05, impliesTrail: true },
  { name: 'Gold',         hex: '#504605', r: 0.80, g: 0.70, b: 0.05, impliesTrail: true },
  { name: 'Grass Green',  hex: '#3fb20c', r: 0.25, g: 0.70, b: 0.05, impliesTrail: false },
  { name: 'Green',        hex: '#26b21c', r: 0.15, g: 0.70, b: 0.11, impliesTrail: false },
  { name: 'Indigo',       hex: '#7f3fff', r: 0.50, g: 0.25, b: 1.15, impliesTrail: false },
  { name: 'Lavender',     hex: '#a03fff', r: 0.63, g: 0.25, b: 1.15, impliesTrail: false },
  { name: 'Lemon',        hex: '#bf990c', r: 0.75, g: 0.60, b: 0.05, impliesTrail: false },
  { name: 'Lime',         hex: '#59b21c', r: 0.35, g: 0.70, b: 0.11, impliesTrail: false },
  { name: 'Magenta',      hex: '#cc19ff', r: 0.80, g: 0.10, b: 1.00, impliesTrail: false },
  { name: 'Orange',       hex: '#e56619', r: 0.90, g: 0.40, b: 0.10, impliesTrail: false },
  { name: 'Peach',        hex: '#cc7f19', r: 0.80, g: 0.50, b: 0.10, impliesTrail: false },
  { name: 'Pink',         hex: '#d859bf', r: 0.85, g: 0.35, b: 0.75, impliesTrail: false },
  { name: 'Plum',         hex: '#b2197f', r: 0.70, g: 0.10, b: 0.50, impliesTrail: false },
  { name: 'Purple',       hex: '#bf3fff', r: 0.75, g: 0.25, b: 1.15, impliesTrail: false },
  { name: 'Red',          hex: '#f21919', r: 0.95, g: 0.10, b: 0.10, impliesTrail: false },
  { name: 'Ruby',         hex: '#f2194c', r: 0.95, g: 0.10, b: 0.30, impliesTrail: false },
  { name: 'Sea Blue',     hex: '#3f7fff', r: 0.25, g: 0.50, b: 1.15, impliesTrail: false },
  { name: 'Silver',       hex: '#4b4b55', r: 0.75, g: 0.75, b: 0.85, impliesTrail: true },
  { name: 'Sky Blue',     hex: '#337fcc', r: 0.20, g: 0.50, b: 0.80, impliesTrail: false },
  { name: 'Turquoise',    hex: '#28a3cc', r: 0.16, g: 0.64, b: 0.80, impliesTrail: false },
  { name: 'Violet',       hex: '#cc66ff', r: 0.80, g: 0.40, b: 1.00, impliesTrail: false },
  { name: 'White',        hex: '#bfbfd8', r: 0.75, g: 0.75, b: 0.85, impliesTrail: false },
  { name: 'Yellow',       hex: '#ccb20c', r: 0.80, g: 0.70, b: 0.05, impliesTrail: false },
];

/**
 * Find the nearest VDL color to an arbitrary RGB value.
 * @param r Red channel (0-255 integer)
 * @param g Green channel (0-255 integer)
 * @param b Blue channel (0-255 integer)
 */
export function rgbToNearestVdl(r: number, g: number, b: number): VdlMatch {
  // Normalize 0-255 → 0-1
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  let best: VdlEntry = VDL_PALETTE[0];
  let bestDist = Infinity;

  for (let i = 0; i < VDL_PALETTE.length; i++) {
    const e = VDL_PALETTE[i];
    const dr = nr - e.r;
    const dg = ng - e.g;
    const db = nb - e.b;
    const dist = dr * dr + dg * dg + db * db; // squared distance (skip sqrt for perf)
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
      if (dist === 0) break; // exact match
    }
  }

  return {
    name: best.name,
    hex: best.hex,
    impliesTrail: best.impliesTrail,
    distance: Math.sqrt(bestDist),
  };
}

/**
 * Convert RGB to a complete VDL descriptor string for Finale 3D export.
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @param noTrail Force "No Trail" suffix (suppresses sparks on trail-implying colors)
 * @returns e.g. "Gold", "Gold No Trail", "Red", "Charcoal Tip"
 */
export function rgbToVdlString(r: number, g: number, b: number, noTrail = false): string {
  const match = rgbToNearestVdl(r, g, b);

  if (match.name === 'Dark') return 'Dark';

  if (match.impliesTrail && noTrail) {
    return `${match.name} Tip`;
  }
  if (!match.impliesTrail && noTrail) {
    return `${match.name} No Trail`;
  }
  return match.name;
}

/**
 * Batch-convert an array of RGB triplets to VDL names.
 * Useful for exporting entire payloadActions arrays.
 */
export function batchRgbToVdl(
  colors: Array<{ r: number; g: number; b: number }>,
  noTrail = false,
): string[] {
  return colors.map(c => rgbToVdlString(c.r, c.g, c.b, noTrail));
}

/** Expose the palette for testing/inspection */
export { VDL_PALETTE };
