/**
 * UE4/5 .uasset Binary Parser — v2.0 Refactored
 * Enhanced metadata extraction with rich tagging taxonomy.
 */

export type UAssetType =
  | 'niagara_system' | 'niagara_emitter'
  | 'blueprint_fixture' | 'blueprint_pyro' | 'blueprint_sfx'
  | 'material' | 'material_instance' | 'material_param_collection'
  | 'curve_table' | 'texture' | 'dmx_library'
  | 'static_mesh' | 'skeletal_mesh' | 'animation' | 'sound_cue' | 'sound_wave'
  | 'level_sequence' | 'widget_blueprint' | 'data_table' | 'particle_system'
  | 'physics_asset' | 'input_action' | 'template_pack'
  | 'unknown';

/** Semantic tag categories for library classification */
export type UAssetTag =
  | 'aerial' | 'ground' | 'sfx' | 'fixture' | 'vfx' | 'audio' | 'mesh'
  | 'material' | 'texture' | 'ui' | 'cinematic' | 'lighting' | 'environment'
  | 'fire' | 'smoke' | 'fog' | 'lightning' | 'rain' | 'snow' | 'water'
  | 'explosion' | 'spark' | 'laser' | 'strobe' | 'ethereal' | 'stylized'
  | 'camera' | 'first-person' | 'third-person' | 'vr' | 'top-down'
  | 'pyro' | 'dmx' | 'artnet' | 'niagara' | 'blueprint'
  | 'radial' | 'directional' | 'volumetric' | 'particle';

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
  /** Rich semantic tags for library classification */
  semanticTags: UAssetTag[];
  suggestedFixtureProfile?: string;
  rawStringTable: string[];
  fileSize: number;
  errors: string[];
}

const UE4_MAGIC = 0x9E2A83C1;

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
    semanticTags: [],
    rawStringTable: [],
    fileSize: buffer.byteLength,
    errors: [],
  };

  try {
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    if (buffer.byteLength < 32) {
      result.errors.push('File too small for .uasset format');
      applyFileNameHeuristics(result, fileName);
      return result;
    }

    const magic = view.getUint32(0, true);
    if (magic !== UE4_MAGIC) {
      result.errors.push(`Invalid magic: 0x${magic.toString(16).toUpperCase()}`);
      applyFileNameHeuristics(result, fileName);
      return result;
    }

    result.valid = true;
    const legacyVersion = view.getInt32(4, true);
    result.engineVersion = Math.abs(legacyVersion);

    const strings = extractStrings(uint8);
    result.rawStringTable = strings;

    // Classify from string table content
    for (const s of strings) {
      const lower = s.toLowerCase();
      if (lower.includes('niagara') || lower.includes('niagarasystem') || lower.includes('ns_')) {
        result.isNiagaraSystem = true;
      }
      if (lower.includes('niagaraemitter') || lower.includes('emitter')) {
        result.isNiagaraEmitter = true;
      }
      if (s.startsWith('/') || s.includes('Script') || s.includes('Class') || s.includes('Module')) {
        result.classNames.push(s);
      } else if (s.length > 3 && s.length < 128 && /^[A-Za-z_]/.test(s)) {
        result.assetNames.push(s);
      }
    }

    result.extractedColors = extractLinearColors(view, buffer.byteLength);
    result.extractedFloats = extractNotableFloats(view, buffer.byteLength);

    const nsName = strings.find(s => s.startsWith('Ns_') || s.startsWith('NS_'));
    result.packageName = nsName || fileName.replace(/\.uasset$/i, '');

  } catch (err) {
    result.errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  applyFileNameHeuristics(result, fileName);
  applySemanticTags(result, fileName);

  return result;
}

// ── String extraction ──
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
  if (current.length >= 4 && !seen.has(current)) strings.push(current);
  return strings;
}

// ── FLinearColor extraction ──
function extractLinearColors(view: DataView, length: number): { r: number; g: number; b: number; a: number }[] {
  const colors: { r: number; g: number; b: number; a: number }[] = [];
  for (let i = 0; i <= length - 16; i += 4) {
    try {
      const r = view.getFloat32(i, true);
      const g = view.getFloat32(i + 4, true);
      const b = view.getFloat32(i + 8, true);
      const a = view.getFloat32(i + 12, true);
      if (r >= 0 && r <= 1.5 && g >= 0 && g <= 1.5 && b >= 0 && b <= 1.5 &&
          a >= 0 && a <= 1.0 && (r + g + b) > 0.01 && a > 0.01 &&
          !(Math.abs(r - g) < 0.001 && Math.abs(g - b) < 0.001 && r < 0.01)) {
        colors.push({ r: Math.min(1, r), g: Math.min(1, g), b: Math.min(1, b), a });
        i += 12;
      }
    } catch { break; }
  }
  const unique: typeof colors = [];
  for (const c of colors) {
    if (!unique.some(u => Math.abs(u.r - c.r) < 0.05 && Math.abs(u.g - c.g) < 0.05 && Math.abs(u.b - c.b) < 0.05)) {
      unique.push(c);
    }
  }
  return unique.slice(0, 12);
}

function extractNotableFloats(view: DataView, length: number): number[] {
  const floats: number[] = [];
  for (let i = 0; i <= length - 4; i += 4) {
    try {
      const val = view.getFloat32(i, true);
      if (val > 5 && val < 10000 && Number.isFinite(val) && val === Math.round(val * 10) / 10) {
        floats.push(val);
      }
    } catch { break; }
  }
  return floats.slice(0, 20);
}

// ── Blueprint → fixture profile mapping ──
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

/** Extended filename patterns for rich classification */
const FILENAME_PATTERNS: { test: RegExp; type: UAssetType; category: UAssetParseResult['heuristic']['suggestedCategory'] }[] = [
  // Templates & packs
  { test: /^tp_/i, type: 'template_pack', category: 'sfx' },
  // Sequences & cinematics
  { test: /^(sequenceroot|shot\d|ls_|levelsequence)/i, type: 'level_sequence', category: 'sfx' },
  // Widget blueprints
  { test: /^wbp_/i, type: 'widget_blueprint', category: 'sfx' },
  // Static meshes
  { test: /^(sm_|staticmesh)/i, type: 'static_mesh', category: 'sfx' },
  // Skeletal meshes
  { test: /^(sk_|skeletalmesh)/i, type: 'skeletal_mesh', category: 'sfx' },
  // Animations
  { test: /^(a_|anim_|montage_)/i, type: 'animation', category: 'sfx' },
  // Sound
  { test: /^(s_|sound_|sfx_|a_sfx|cue_)/i, type: 'sound_cue', category: 'sfx' },
  // VR/AR assets
  { test: /\b(vr_|vive|oculus|handheldar|motioncontroller|teleport)/i, type: 'blueprint_sfx', category: 'sfx' },
  // Data tables
  { test: /^(dt_|datatable)/i, type: 'data_table', category: 'sfx' },
  // Physics
  { test: /^(pa_|phys_)/i, type: 'physics_asset', category: 'sfx' },
  // Input
  { test: /^(ia_|inputaction)/i, type: 'input_action', category: 'sfx' },
  // Curve tables
  { test: /(_strobe_table|_table$|^ct_)/i, type: 'curve_table', category: 'fixture' },
  // MPC
  { test: /^mpc_/i, type: 'material_param_collection', category: 'fixture' },
  // Material instances
  { test: /^mi_/i, type: 'material_instance', category: 'sfx' },
  // Materials
  { test: /^(m_|mat_)/i, type: 'material', category: 'sfx' },
  // Textures & virtual textures
  { test: /^(t_|vt_|tex_)/i, type: 'texture', category: 'sfx' },
  // DMX
  { test: /dmxlib/i, type: 'dmx_library', category: 'fixture' },
  // Material functions
  { test: /^mf_/i, type: 'material', category: 'sfx' },
  // Fixture blueprints
  { test: /^bp_(spot|wash|static|toner|audience|stadium|strobe|staticmatrix)/i, type: 'blueprint_fixture', category: 'fixture' },
  // Pyro blueprints
  { test: /^bp_(pyro|firework)/i, type: 'blueprint_pyro', category: 'aerial' },
  // Laser/SFX blueprints
  { test: /^bp_(laser|sphere|fog|smoke|cryo|flame)/i, type: 'blueprint_sfx', category: 'sfx' },
];

/** Content keyword → semantic tag mapping */
const CONTENT_TAG_RULES: { test: RegExp; tags: UAssetTag[] }[] = [
  { test: /fire|flame|flamer/i, tags: ['fire', 'vfx', 'sfx'] },
  { test: /smoke|haze/i, tags: ['smoke', 'vfx', 'environment'] },
  { test: /fog|mist|cloud/i, tags: ['fog', 'vfx', 'environment', 'volumetric'] },
  { test: /lightning|thunder/i, tags: ['lightning', 'vfx', 'environment'] },
  { test: /rain/i, tags: ['rain', 'vfx', 'environment'] },
  { test: /snow|ice/i, tags: ['snow', 'vfx', 'environment'] },
  { test: /water|ocean|wave/i, tags: ['water', 'vfx', 'environment'] },
  { test: /explo|burst|bang/i, tags: ['explosion', 'vfx', 'aerial'] },
  { test: /spark|trail/i, tags: ['spark', 'vfx'] },
  { test: /laser|beam/i, tags: ['laser', 'sfx', 'lighting'] },
  { test: /strobe|flash/i, tags: ['strobe', 'sfx', 'lighting'] },
  { test: /ethereal|magic|spirit|ghost/i, tags: ['ethereal', 'vfx', 'stylized'] },
  { test: /stylized/i, tags: ['stylized', 'vfx'] },
  { test: /radial/i, tags: ['radial', 'vfx'] },
  { test: /firstperson|fps/i, tags: ['camera', 'first-person'] },
  { test: /thirdperson|tps/i, tags: ['camera', 'third-person'] },
  { test: /topdown/i, tags: ['camera', 'top-down'] },
  { test: /\bvr\b|virtualreality|oculus|vive/i, tags: ['vr', 'camera'] },
  { test: /handheldar/i, tags: ['camera'] },
  { test: /vehicle/i, tags: ['camera'] },
  { test: /niagara|ns_|emitter/i, tags: ['niagara', 'vfx', 'particle'] },
  { test: /dmx|artnet|sacn/i, tags: ['dmx', 'artnet'] },
  { test: /pyro|firework|shell|mortar/i, tags: ['pyro', 'aerial'] },
  { test: /\bbp_/i, tags: ['blueprint'] },
  { test: /directional/i, tags: ['directional', 'lighting'] },
  { test: /volumetric/i, tags: ['volumetric', 'environment'] },
  { test: /particle|emitter/i, tags: ['particle', 'vfx'] },
  { test: /light|lamp|spot|wash/i, tags: ['lighting', 'fixture'] },
  { test: /cryo|co2|confetti/i, tags: ['sfx'] },
  { test: /gerb|fountain|mine/i, tags: ['pyro', 'ground'] },
  { test: /camera|cam_/i, tags: ['camera', 'cinematic'] },
  { test: /sequence|shot\d/i, tags: ['cinematic'] },
  { test: /widget|wbp_|menu|hud/i, tags: ['ui'] },
  { test: /audio|sound|sfx_|cue_/i, tags: ['audio'] },
  { test: /mesh|sm_|sk_/i, tags: ['mesh'] },
  { test: /texture|t_|vt_/i, tags: ['texture'] },
  { test: /material|m_|mi_|mf_/i, tags: ['material'] },
];

function applyFileNameHeuristics(result: UAssetParseResult, fileName: string): void {
  const rawName = fileName.replace(/\.uasset$/i, '');
  const name = rawName.replace(/_/g, ' ');
  const lower = name.toLowerCase();
  const rawLower = rawName.toLowerCase();

  result.heuristic.suggestedName = name;

  // Pattern-based type classification
  for (const rule of FILENAME_PATTERNS) {
    if (rule.test.test(rawLower)) {
      result.assetType = rule.type;
      result.heuristic.suggestedCategory = rule.category;
      // Fixture profile mapping
      if (rule.type === 'blueprint_fixture') {
        const matchKey = Object.keys(BLUEPRINT_FIXTURE_MAP).find(k => rawLower.startsWith(k));
        if (matchKey) result.suggestedFixtureProfile = BLUEPRINT_FIXTURE_MAP[matchKey];
      }
      break;
    }
  }

  // Fall back to string-table classification if still unknown
  if (result.assetType === 'unknown') {
    if (result.isNiagaraSystem) result.assetType = 'niagara_system';
    else if (result.isNiagaraEmitter) result.assetType = 'niagara_emitter';
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
    ethereal: { color: '#22DDFF', pattern: 'peony' },
  };

  for (const [key, val] of Object.entries(colorMap)) {
    if (lower.includes(key)) {
      result.heuristic.suggestedColor = val.color;
      result.heuristic.suggestedPattern = val.pattern;
      break;
    }
  }

  // Category refinement
  if (result.heuristic.suggestedCategory === 'aerial') {
    if (lower.includes('fountain') || lower.includes('gerb') || lower.includes('ground')) {
      result.heuristic.suggestedCategory = 'ground';
    } else if (lower.includes('cryo') || lower.includes('flame') || lower.includes('fog') || lower.includes('confetti')) {
      result.heuristic.suggestedCategory = 'sfx';
    }
  }
}

/** Apply rich semantic tags based on filename + string table content */
function applySemanticTags(result: UAssetParseResult, fileName: string): void {
  const tagSet = new Set<UAssetTag>();
  const combined = `${fileName} ${result.rawStringTable.join(' ')}`;

  for (const rule of CONTENT_TAG_RULES) {
    if (rule.test.test(combined)) {
      rule.tags.forEach(t => tagSet.add(t));
    }
  }

  // Add base category tag
  tagSet.add(result.heuristic.suggestedCategory as UAssetTag);

  // Add type-specific tags
  switch (result.assetType) {
    case 'niagara_system':
    case 'niagara_emitter':
      tagSet.add('niagara'); tagSet.add('vfx'); tagSet.add('particle');
      break;
    case 'texture':
      tagSet.add('texture');
      break;
    case 'material':
    case 'material_instance':
      tagSet.add('material');
      break;
    case 'static_mesh':
    case 'skeletal_mesh':
      tagSet.add('mesh');
      break;
    case 'sound_cue':
    case 'sound_wave':
      tagSet.add('audio');
      break;
    case 'level_sequence':
      tagSet.add('cinematic');
      break;
    case 'widget_blueprint':
      tagSet.add('ui');
      break;
    case 'blueprint_fixture':
      tagSet.add('fixture'); tagSet.add('lighting'); tagSet.add('dmx');
      break;
    case 'blueprint_pyro':
      tagSet.add('pyro'); tagSet.add('aerial');
      break;
    case 'template_pack':
      tagSet.add('camera');
      break;
  }

  result.semanticTags = Array.from(tagSet);
}

export function linearColorToHex(c: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

export function parseUMap(buffer: ArrayBuffer, fileName: string): UAssetParseResult {
  const result = parseUAsset(buffer, fileName);
  const niagaraRefs = result.rawStringTable.filter(s =>
    s.includes('Niagara') || s.includes('Ns_') || s.includes('NS_') || s.includes('Firework')
  );
  if (niagaraRefs.length > 0) {
    result.assetNames.push(...niagaraRefs);
    result.isNiagaraSystem = true;
  }
  return result;
}
