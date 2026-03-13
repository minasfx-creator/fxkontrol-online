/**
 * ─── Finale 3D Catalog Importer ──────────────────────────────────────
 * Parses CSV/FDB catalog files from Finale 3D and maps columns
 * to our internal Effect format. Supports auto-detection of:
 * - Finale 3D .fdb (tab/comma separated)
 * - Generic CSV with Finale-compatible headers
 * - VDL-style description parsing
 */

import type { Effect, PartType } from '@/store/useProjectStore';

// Known Finale 3D column headers (case-insensitive)
const COLUMN_ALIASES: Record<string, string[]> = {
  name:        ['name', 'description', 'desc', 'product', 'product_name', 'item', 'effect', 'effet'],
  caliber:     ['caliber', 'size', 'bore', 'diameter', 'cal', 'calibre', 'size_inches', 'inch'],
  duration:    ['duration', 'dur', 'time', 'burn_time', 'effect_time', 'burn', 'display_time'],
  color:       ['color', 'colour', 'colors', 'effect_color', 'star_color', 'primary_color'],
  type:        ['type', 'part_type', 'device_type', 'class', 'category', 'kind', 'parttype'],
  height:      ['height', 'break_height', 'altitude', 'elevation', 'height_m', 'height_ft', 'lift_height'],
  cost:        ['cost', 'price', 'unit_price', 'unit_cost', 'retail', 'wholesale'],
  prefire:     ['prefire', 'pre_fire', 'lift_time', 'pft', 'rise_time', 'fuse_time'],
  pattern:     ['pattern', 'burst_pattern', 'burst_type', 'effect_type', 'star_pattern'],
  shotCount:   ['shots', 'shot_count', 'num_shots', 'count', 'tubes', 'num_tubes'],
  safety:      ['safety', 'safety_distance', 'nfpa_distance', 'safe_dist', 'safety_m'],
  vdl:         ['vdl', 'visual_description', 'vdl_string'],
  sku:         ['sku', 'part_number', 'part_no', 'item_no', 'product_code', 'article'],
  manufacturer:['manufacturer', 'mfg', 'supplier', 'brand', 'vendor', 'factory'],
};

// Part type mapping from Finale 3D keywords
const PART_TYPE_MAP: Record<string, PartType> = {
  shell: 'shell',
  shells: 'shell',
  mortar: 'shell',
  single: 'single_shot',
  'single shot': 'single_shot',
  mine: 'mine',
  mines: 'mine',
  cake: 'cake',
  cakes: 'cake',
  battery: 'cake',
  roman: 'candle',
  'roman candle': 'candle',
  candle: 'candle',
  gerb: 'gerb',
  fountain: 'gerb',
  waterfall: 'waterfall',
  cascade: 'waterfall',
  comet: 'comet',
  rocket: 'rocket',
  fan: 'fan',
  set_piece: 'set_piece',
  'set piece': 'set_piece',
  ground: 'ground',
  flame: 'flame',
  strobe: 'strobe',
  laser: 'laser',
  light: 'light',
  sfx: 'sfx',
};

// Color name to hex mapping
const COLOR_MAP: Record<string, string> = {
  red: '#FF0000', green: '#00FF00', blue: '#0000FF', gold: '#FFD700',
  silver: '#C0C0C0', white: '#FFFFFF', yellow: '#FFFF00', orange: '#FFA500',
  purple: '#9B30FF', pink: '#FF69B4', cyan: '#00FFFF', magenta: '#FF00FF',
  brocade: '#FFE4B5', willow: '#FFA500', coconut: '#FF6347', titanium: '#E8E8E8',
  crackling: '#FFA07A', glitter: '#C0C0C0', nishiki: '#FFD700', kamuro: '#FFD700',
  chrysanthemum: '#FFD700', peony: '#FF4444', dahlia: '#9B30FF', palm: '#FF6347',
  crossette: '#FF4500', horsetail: '#FFB347', spider: '#00FF7F',
};

export interface CatalogColumnMapping {
  header: string;
  mappedTo: string | null;
  sampleValues: string[];
}

export interface ParsedCatalogEffect {
  name: string;
  caliber: number;
  duration: number;
  color: string;
  colorHex: string;
  partType: PartType;
  height: number;
  cost: number;
  prefire: number;
  pattern: string;
  shotCount: number;
  safetyDistance: number;
  vdl: string;
  sku: string;
  manufacturer: string;
  raw: Record<string, string>;
}

/** Detect delimiter (tab, comma, semicolon) */
function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  if (tabCount >= commaCount && tabCount >= semiCount) return '\t';
  if (semiCount >= commaCount) return ';';
  return ',';
}

/** Auto-map a header to our known fields */
function autoMapHeader(header: string): string | null {
  const h = header.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => h === a || h.includes(a))) {
      return field;
    }
  }
  return null;
}

/** Parse color from text — handles "Red", "Red/Green", "#FF0000", etc */
function parseColor(text: string): string {
  if (!text) return '#FFD700';
  // Direct hex
  if (text.startsWith('#') && text.length >= 7) return text;
  // Named colors
  const lower = text.toLowerCase().trim();
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(name)) return hex;
  }
  return '#FFD700';
}

/** Parse part type from text */
function parsePartType(text: string): PartType {
  if (!text) return 'shell';
  const lower = text.toLowerCase().trim();
  for (const [key, type] of Object.entries(PART_TYPE_MAP)) {
    if (lower.includes(key)) return type;
  }
  return 'shell';
}

/** Infer category from part type */
function inferCategory(partType: PartType): Effect['category'] {
  switch (partType) {
    case 'shell': case 'single_shot': case 'comet': case 'fan': case 'rocket': case 'ground': return 'morteiros';
    case 'mine': return 'mines';
    case 'candle': return 'roman_candles';
    case 'waterfall': return 'waterfalls';
    case 'cake': return 'cakes_batteries';
    case 'gerb': case 'flame': case 'sfx': case 'strobe': case 'set_piece': return 'sfx';
    case 'laser': return 'lasers';
    case 'light': return 'iluminacao';
    case 'drone': case 'formation': return 'drones';
    default: return 'morteiros';
  }
}

/** Infer effect type from part type */
function inferEffectType(partType: PartType): Effect['type'] {
  if (partType === 'laser') return 'laser';
  if (partType === 'light') return 'light';
  if (partType === 'drone' || partType === 'formation') return 'drone';
  if (partType === 'sfx' || partType === 'flame' || partType === 'strobe') return 'sfx';
  return 'firework';
}

/** Get icon for part type */
function getPartTypeIcon(partType: PartType): string {
  const icons: Record<string, string> = {
    shell: '💥', single_shot: '🔥', comet: '☄️', mine: '⛏️', cake: '🎂',
    candle: '🕯️', gerb: '✳️', waterfall: '🌊', fan: '🪭', rocket: '🚀',
    flame: '🔥', sfx: '💨', ground: '💢', strobe: '⚡', set_piece: '🏛️',
    laser: '🟢', light: '💡', drone: '🛸', formation: '🔷',
  };
  return icons[partType] || '💥';
}

/** Parse a full catalog file — returns column mappings and parsed effects */
export function parseCatalogFile(text: string): {
  columns: CatalogColumnMapping[];
  effects: ParsedCatalogEffect[];
  delimiter: string;
  rowCount: number;
} {
  const delimiter = detectDelimiter(text);
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { columns: [], effects: [], delimiter, rowCount: 0 };

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Build column mappings
  const columns: CatalogColumnMapping[] = headers.map((header, i) => ({
    header,
    mappedTo: autoMapHeader(header),
    sampleValues: lines.slice(1, 4).map(l => {
      const cols = l.split(delimiter);
      return (cols[i] || '').trim().replace(/^"|"$/g, '');
    }),
  }));

  // Parse rows
  const effects: ParsedCatalogEffect[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => { raw[h] = cols[j] || ''; });

    // Get values by mapping
    const getValue = (field: string): string => {
      const colIdx = columns.findIndex(c => c.mappedTo === field);
      return colIdx >= 0 ? (cols[colIdx] || '') : '';
    };

    const name = getValue('name') || `Effect ${i}`;
    const colorText = getValue('color');
    const typeText = getValue('type');
    const partType = parsePartType(typeText || name);

    effects.push({
      name,
      caliber: parseFloat(getValue('caliber')) || (partType === 'shell' ? 3 : 0),
      duration: parseFloat(getValue('duration')) || (partType === 'shell' ? 3 : 5),
      color: colorText || 'Gold',
      colorHex: parseColor(colorText || name),
      partType,
      height: parseFloat(getValue('height')) || 0,
      cost: parseFloat(getValue('cost')) || 0,
      prefire: parseFloat(getValue('prefire')) || 0,
      pattern: getValue('pattern') || '',
      shotCount: parseInt(getValue('shotCount')) || 0,
      safetyDistance: parseFloat(getValue('safety')) || 0,
      vdl: getValue('vdl') || '',
      sku: getValue('sku') || '',
      manufacturer: getValue('manufacturer') || '',
      raw,
    });
  }

  return { columns, effects, delimiter, rowCount: effects.length };
}

/** Convert parsed catalog effects to our internal Effect format */
export function catalogToEffects(parsed: ParsedCatalogEffect[], idPrefix: string = 'cat'): Effect[] {
  return parsed.map((p, i) => {
    const partType = p.partType;
    const category = inferCategory(partType);
    const type = inferEffectType(partType);
    const caliber = p.caliber || (partType === 'shell' ? 3 : undefined);
    const height = p.height || (caliber ? caliber * 20 : undefined);

    return {
      id: `${idPrefix}-${Date.now()}-${i}`,
      name: p.name,
      category,
      type,
      color: p.colorHex,
      duration: p.duration,
      cost: p.cost,
      icon: getPartTypeIcon(partType),
      partType,
      caliber,
      heightMeters: height,
      prefire: p.prefire || undefined,
      pattern: p.pattern || undefined,
      shotCount: p.shotCount || undefined,
      safetyDistance: p.safetyDistance || undefined,
      vdl: p.vdl || undefined,
    };
  });
}
