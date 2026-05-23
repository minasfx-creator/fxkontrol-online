/**
 * VDL Color Pipeline — RGB → VDL render-accurate color
 * ─────────────────────────────────────────────────────
 *
 * Goal: every color rendered in the 3D viewport must match what the real
 * drone LED / pyro fixture will actually emit when commanded by a Finale 3D
 * VDL string. Arbitrary 24-bit RGB (16M values) is quantized to the closest
 * canonical VDL palette entry (25 colors), then re-tinted by the input
 * luminance so dim cues stay dim.
 *
 * Pipeline (single source of truth):
 *   srcRGB(0..255) ─► nearest-VDL (Euclidean in normalized RGB)
 *                  ├─► export name  (e.g. "Gold No Trail")  → Finale 3D string
 *                  ├─► palette hex  (LED-accurate base color)
 *                  └─► render hex   (palette × inputLuminance / paletteLuminance)
 *
 * LRU cache: keyed by packed 24-bit RGB. Cap = 256 entries (matches the
 * project-wide Zero-GC color cache convention — see
 * mem://arquitetura/otimizacao-render-zero-gc-refinamentos).
 *
 * NOTE: this is the ONLY place where render and export agree on a color.
 * The vvizWorker and any future LED renderer should call `quantizeRgbToVdl`
 * instead of computing their own hex strings.
 */

import { rgbToNearestVdl, type VdlMatch } from '@/lib/vdlQuantizer';

export interface VdlRenderColor {
  /** Canonical VDL color name, e.g. "Gold". */
  name: string;
  /** "Gold No Trail" / "Gold Tip" / plain "Gold" — Finale 3D-ready. */
  exportName: string;
  /** Raw VDL palette hex — what the real LED would emit at full brightness. */
  paletteHex: string;
  /** Render hex — palette tinted by input luminance so dim inputs stay dim. */
  renderHex: string;
  /** Input luminance, 0..1 (Rec. 709). */
  brightness: number;
  /** True when the VDL family adds a comet trail by default. */
  impliesTrail: boolean;
  /** Quantization distance in normalized RGB (0..√3). Lower = better. */
  distance: number;
}

const LRU_CAP = 256;

// ── LRU cache (Map preserves insertion order; refresh on hit) ───────
const _cache = new Map<number, VdlRenderColor>();
let _hits = 0;
let _misses = 0;

function packKey(r: number, g: number, b: number, noTrail: boolean): number {
  // 8|8|8|1 = 25 bits — well inside safe integer range.
  return ((r & 0xff) << 17) | ((g & 0xff) << 9) | ((b & 0xff) << 1) | (noTrail ? 1 : 0);
}

function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Rec. 709 luma (0..1) from sRGB (0..255). Cheap, gamma-naive on purpose. */
export function rec709Luma(r: number, g: number, b: number): number {
  return Math.min(1, Math.max(0, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
}

function hex2(n: number): string {
  return clamp255(n).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + hex2(r) + hex2(g) + hex2(b);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const v = parseInt(h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h.slice(0, 6), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function buildExportName(match: VdlMatch, noTrail: boolean): string {
  if (match.name === 'Dark') return 'Dark';
  if (match.impliesTrail && noTrail) return `${match.name} Tip`;
  if (!match.impliesTrail && noTrail) return `${match.name} No Trail`;
  return match.name;
}

/**
 * Quantize an arbitrary RGB triplet to its render-accurate VDL color.
 * Cached by (r, g, b, noTrail).
 */
export function quantizeRgbToVdl(
  r: number, g: number, b: number, noTrail = false,
): VdlRenderColor {
  const cr = clamp255(r), cg = clamp255(g), cb = clamp255(b);
  const key = packKey(cr, cg, cb, noTrail);

  const cached = _cache.get(key);
  if (cached) {
    _hits++;
    // Refresh LRU recency.
    _cache.delete(key);
    _cache.set(key, cached);
    return cached;
  }
  _misses++;

  const match = rgbToNearestVdl(cr, cg, cb);
  const inputLuma = rec709Luma(cr, cg, cb);

  // Palette luma (computed from VDL hex). Guard against pure-black palette
  // entries to avoid divide-by-zero — "Dark" stays #000000 regardless.
  const [pr, pg, pb] = hexToRgb(match.hex);
  const paletteLuma = rec709Luma(pr, pg, pb);
  const scale = paletteLuma > 0.001 ? inputLuma / paletteLuma : 0;

  const renderHex = match.name === 'Dark'
    ? '#000000'
    : rgbToHex(pr * scale, pg * scale, pb * scale);

  const out: VdlRenderColor = {
    name: match.name,
    exportName: buildExportName(match, noTrail),
    paletteHex: match.hex,
    renderHex,
    brightness: inputLuma,
    impliesTrail: match.impliesTrail,
    distance: match.distance,
  };

  _cache.set(key, out);
  if (_cache.size > LRU_CAP) {
    // Evict the oldest entry (first key in insertion order).
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }

  return out;
}

/** Convenience: return only the render hex string. */
export function rgbToRenderHex(r: number, g: number, b: number): string {
  return quantizeRgbToVdl(r, g, b).renderHex;
}

/** Convenience: convert any input hex to its VDL render hex. */
export function hexToRenderHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return quantizeRgbToVdl(r, g, b).renderHex;
}

/** Cache stats (diagnostics only — not persisted). */
export function getVdlPipelineStats(): { hits: number; misses: number; size: number; cap: number } {
  return { hits: _hits, misses: _misses, size: _cache.size, cap: LRU_CAP };
}

/** Reset cache + counters (test hook). */
export function resetVdlPipelineCache(): void {
  _cache.clear();
  _hits = 0;
  _misses = 0;
}
