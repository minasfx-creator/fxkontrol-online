/**
 * UE4/5 .uasset Binary Parser
 * Extracts metadata from Unreal Engine asset files:
 * - Magic header validation
 * - String table (asset names, class references)
 * - FLinearColor extraction (4x float32 RGBA)
 * - Niagara system/emitter identification
 */

export type UAssetType =
  | 'niagara_system' | 'niagara_emitter'
  | 'blueprint_fixture' | 'blueprint_pyro' | 'blueprint_sfx'
  | 'material' | 'material_instance' | 'material_param_collection'
  | 'curve_table' | 'texture' | 'dmx_library' | 'unknown';

export interface UAssetParseResult {
  valid: boolean;
  engineVersion: number;
  packageName: string;
  assetNames: string[];
  classNames: string[];
  isNiagaraSystem: boolean;
  isNiagaraEmitter: boolean;
  extractedColors: { r: number; g: number; b: number; a: number }[];
  extractedFloats: number[];
  heuristic: {
    suggestedName: string;
    suggestedColor: string;
    suggestedPattern: string;
    suggestedCategory: 'aerial' | 'ground' | 'sfx' | 'fixture';
  };
  assetType: UAssetType;
  suggestedFixtureProfile?: string;
  rawStringTable: string[];
  fileSize: number;
  errors: string[];
}

const UE4_MAGIC = 0x9E2A83C1; // UE4 package magic number (little-endian)

/**
 * Parse a UE4/5 .uasset file from an ArrayBuffer.
 */
export function parseUAsset(buffer: ArrayBuffer, fileName: string): UAssetParseResult {
  const result: UAssetParseResult = {
    valid: false,
    engineVersion: 0,
    packageName: '',
    assetNames: [],
    classNames: [],
    isNiagaraSystem: false,
    isNiagaraEmitter: false,
    extractedColors: [],
    extractedFloats: [],
    heuristic: {
      suggestedName: fileName.replace(/\.uasset$/i, ''),
      suggestedColor: '#FFFFFF',
      suggestedPattern: 'peony',
      suggestedCategory: 'aerial',
    },
    assetType: 'unknown',
    rawStringTable: [],
    fileSize: buffer.byteLength,
    errors: [],
  };

  try {
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // 1. Validate magic header
    if (buffer.byteLength < 32) {
      result.errors.push('File too small for .uasset format');
      applyFileNameHeuristics(result, fileName);
      return result;
    }

    const magic = view.getUint32(0, true);
    if (magic !== UE4_MAGIC) {
      result.errors.push(`Invalid magic: 0x${magic.toString(16).toUpperCase()} (expected 0x9E2A83C1)`);
      applyFileNameHeuristics(result, fileName);
      return result;
    }

    result.valid = true;

    // 2. Read legacy version and engine version
    const legacyVersion = view.getInt32(4, true);
    result.engineVersion = Math.abs(legacyVersion);

    // 3. Extract string table — scan for readable ASCII strings
    const strings = extractStrings(uint8);
    result.rawStringTable = strings;

    // Identify Niagara references
    for (const s of strings) {
      const lower = s.toLowerCase();
      if (lower.includes('niagara') || lower.includes('niagarasystem') || lower.includes('ns_')) {
        result.isNiagaraSystem = true;
      }
      if (lower.includes('niagaraemitter') || lower.includes('emitter')) {
        result.isNiagaraEmitter = true;
      }
      // Collect asset and class names
      if (s.startsWith('/') || s.includes('Script') || s.includes('Class') || s.includes('Module')) {
        result.classNames.push(s);
      } else if (s.length > 3 && s.length < 128 && /^[A-Za-z_]/.test(s)) {
        result.assetNames.push(s);
      }
    }

    // 4. Extract potential FLinearColor values (4 consecutive float32 in 0-1 range)
    result.extractedColors = extractLinearColors(view, buffer.byteLength);

    // 5. Extract notable float values (particle counts, lifetimes, velocities)
    result.extractedFloats = extractNotableFloats(view, buffer.byteLength);

    // 6. Derive package name
    const nsName = strings.find(s => s.startsWith('Ns_') || s.startsWith('NS_'));
    result.packageName = nsName || fileName.replace(/\.uasset$/i, '');

  } catch (err) {
    result.errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Always apply filename heuristics as fallback / enrichment
  applyFileNameHeuristics(result, fileName);

  return result;
}

/**
 * Extract readable ASCII/UTF-8 strings from binary data.
 * Looks for null-terminated strings and FString patterns.
 */
function extractStrings(data: Uint8Array): string[] {
  const strings: string[] = [];
  const seen = new Set<string>();
  let current = '';

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte >= 32 && byte < 127) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 4 && !seen.has(current)) {
        seen.add(current);
        strings.push(current);
      }
      current = '';
    }
  }
  if (current.length >= 4 && !seen.has(current)) {
    strings.push(current);
  }

  return strings;
}

/**
 * Scan for FLinearColor (4x float32, each 0.0–1.0).
 */
function extractLinearColors(view: DataView, length: number): { r: number; g: number; b: number; a: number }[] {
  const colors: { r: number; g: number; b: number; a: number }[] = [];
  const step = 4;

  for (let i = 0; i <= length - 16; i += step) {
    try {
      const r = view.getFloat32(i, true);
      const g = view.getFloat32(i + 4, true);
      const b = view.getFloat32(i + 8, true);
      const a = view.getFloat32(i + 12, true);

      // Valid color: all components 0–1, at least one non-zero RGB, alpha > 0
      if (
        r >= 0 && r <= 1.5 &&
        g >= 0 && g <= 1.5 &&
        b >= 0 && b <= 1.5 &&
        a >= 0 && a <= 1.0 &&
        (r + g + b) > 0.01 &&
        a > 0.01 &&
        // Filter false positives: not all nearly equal (likely padding)
        !(Math.abs(r - g) < 0.001 && Math.abs(g - b) < 0.001 && r < 0.01)
      ) {
        colors.push({
          r: Math.min(1, r),
          g: Math.min(1, g),
          b: Math.min(1, b),
          a,
        });
        i += 12; // Skip past this color
      }
    } catch {
      break;
    }
  }

  // Deduplicate similar colors
  const unique: typeof colors = [];
  for (const c of colors) {
    const isDupe = unique.some(u =>
      Math.abs(u.r - c.r) < 0.05 &&
      Math.abs(u.g - c.g) < 0.05 &&
      Math.abs(u.b - c.b) < 0.05
    );
    if (!isDupe) unique.push(c);
  }

  return unique.slice(0, 12); // Max 12 distinct colors
}

/**
 * Extract notable float values that could be particle parameters.
 */
function extractNotableFloats(view: DataView, length: number): number[] {
  const floats: number[] = [];

  for (let i = 0; i <= length - 4; i += 4) {
    try {
      const val = view.getFloat32(i, true);
      // Particle counts (10-10000), lifetimes (0.1-30), velocities (1-200)
      if (val > 5 && val < 10000 && Number.isFinite(val) && val === Math.round(val * 10) / 10) {
        floats.push(val);
      }
    } catch {
      break;
    }
  }

  return floats.slice(0, 20);
}

/**
 * Derive effect properties from the filename using Niagara naming conventions.
 */
/** Blueprint → fixture profile mapping */
const BLUEPRINT_FIXTURE_MAP: Record<string, string> = {
  'bp_spotmh1': 'spot-mh-standard',
  'bp_spotmh2': 'spot-mh-standard',
  'bp_spotmh2_hq': 'spot-mh-hq',
  'bp_washmh1': 'moving-head-wash',
  'bp_washmh2': 'moving-head-wash',
  'bp_washled': 'wash-led-par',
  'bp_washsl1': 'wash-spotlight',
  'bp_static_scenelight': 'static-scene-light',
  'bp_static_toner': 'static-toner',
  'bp_tonerwbeam': 'toner-beam',
  'bp_audience_toner': 'audience-toner',
  'bp_stadiumlights': 'stadium-light',
  'bp_staticmatrix_5x1': 'led-matrix-5x1',
  'bp_staticmatrix_noborder': 'led-matrix-panel',
  'bp_staticmatrix': 'led-matrix-panel',
  'bp_strobe1': 'strobe-high-power',
  'bp_sphere': 'generic-rgbw',
};

function applyFileNameHeuristics(result: UAssetParseResult, fileName: string): void {
  const rawName = fileName.replace(/\.uasset$/i, '');
  const name = rawName.replace(/_/g, ' ');
  const lower = name.toLowerCase();
  const rawLower = rawName.toLowerCase();

  result.heuristic.suggestedName = name;

  // ── Asset type classification by prefix/pattern ──
  if (rawLower.endsWith('_strobe_table') || rawLower.endsWith('_table')) {
    result.assetType = 'curve_table';
    result.heuristic.suggestedCategory = 'fixture';
  } else if (rawLower.startsWith('mpc_')) {
    result.assetType = 'material_param_collection';
    result.heuristic.suggestedCategory = 'fixture';
  } else if (rawLower.startsWith('mi_')) {
    result.assetType = 'material_instance';
  } else if (rawLower.startsWith('m_') && !rawLower.startsWith('mi_')) {
    result.assetType = 'material';
  } else if (rawLower.startsWith('t_')) {
    result.assetType = 'texture';
  } else if (rawLower.startsWith('dmxlib') || rawLower.includes('dmxlib')) {
    result.assetType = 'dmx_library';
    result.heuristic.suggestedCategory = 'fixture';
  } else if (rawLower.startsWith('bp_spot') || rawLower.startsWith('bp_wash') || rawLower.startsWith('bp_static') ||
             rawLower.startsWith('bp_toner') || rawLower.startsWith('bp_audience') || rawLower.startsWith('bp_stadium') ||
             rawLower.startsWith('bp_strobe') || rawLower.startsWith('bp_staticmatrix')) {
    result.assetType = 'blueprint_fixture';
    result.heuristic.suggestedCategory = 'fixture';
    // Map to fixture profile
    const matchKey = Object.keys(BLUEPRINT_FIXTURE_MAP).find(k => rawLower.startsWith(k));
    if (matchKey) {
      result.suggestedFixtureProfile = BLUEPRINT_FIXTURE_MAP[matchKey];
    }
  } else if (rawLower.startsWith('bp_pyro') || rawLower.startsWith('bp_firework')) {
    result.assetType = 'blueprint_pyro';
    result.heuristic.suggestedCategory = 'aerial';
  } else if (rawLower.startsWith('bp_laser')) {
    result.assetType = 'blueprint_sfx';
    result.heuristic.suggestedCategory = 'sfx';
  } else if (rawLower.startsWith('bp_sphere')) {
    result.assetType = 'blueprint_sfx';
    result.heuristic.suggestedCategory = 'sfx';
  } else if (result.isNiagaraSystem) {
    result.assetType = 'niagara_system';
  } else if (result.isNiagaraEmitter) {
    result.assetType = 'niagara_emitter';
  }

  // Color detection from filename
  const colorMap: Record<string, { color: string; pattern: string }> = {
    blue: { color: '#0066FF', pattern: 'peony' },
    red: { color: '#FF0000', pattern: 'peony' },
    green: { color: '#00FF88', pattern: 'chrysanthemum' },
    yellow: { color: '#FFD700', pattern: 'chrysanthemum' },
    gold: { color: '#FFD700', pattern: 'kamuro' },
    pink: { color: '#FF69B4', pattern: 'crossette' },
    purple: { color: '#9B30FF', pattern: 'peony' },
    white: { color: '#FFFFFF', pattern: 'strobe' },
    silver: { color: '#C0C0C0', pattern: 'kamuro' },
    orange: { color: '#FF8C00', pattern: 'chrysanthemum' },
    cyan: { color: '#00FFFF', pattern: 'peony' },
    magenta: { color: '#FF00FF', pattern: 'peony' },
  };

  for (const [key, val] of Object.entries(colorMap)) {
    if (lower.includes(key)) {
      result.heuristic.suggestedColor = val.color;
      result.heuristic.suggestedPattern = val.pattern;
      break;
    }
  }

  // Category detection (only override if not already set by asset type)
  if (result.heuristic.suggestedCategory === 'aerial') {
    if (lower.includes('firework') || lower.includes('shell') || lower.includes('burst')) {
      result.heuristic.suggestedCategory = 'aerial';
    } else if (lower.includes('fountain') || lower.includes('gerb') || lower.includes('ground')) {
      result.heuristic.suggestedCategory = 'ground';
    } else if (lower.includes('cryo') || lower.includes('flame') || lower.includes('fog') || lower.includes('confetti')) {
      result.heuristic.suggestedCategory = 'sfx';
    }
  }
}

/**
 * Convert FLinearColor to CSS hex string.
 */
export function linearColorToHex(c: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

/**
 * Parse a .umap file (same UE4 format, contains level/scene data).
 */
export function parseUMap(buffer: ArrayBuffer, fileName: string): UAssetParseResult {
  const result = parseUAsset(buffer, fileName);
  // UMap files contain level data — look for placed Niagara system references
  const niagaraRefs = result.rawStringTable.filter(s =>
    s.includes('Niagara') || s.includes('Ns_') || s.includes('NS_') || s.includes('Firework')
  );
  if (niagaraRefs.length > 0) {
    result.assetNames.push(...niagaraRefs);
    result.isNiagaraSystem = true;
  }
  return result;
}
