/**
 * ─── FinalePart — Canonical Finale 3D Part Library record ──────────
 * 35-field schema mirroring the official Finale 3D part library XLSX
 * (Showven ✔️ Finale Verified, Lidu USA, Magic Fireworks, Winda, Amazon).
 *
 * This is the canonical effect-import schema for FXKONTROL.
 * Older typescript `Effect` records remain the runtime contract for the
 * 3D engine (see src/data/effectLibrary.ts); `finalePartToEffect()`
 * adapts a FinalePart into an Effect with VDL-accurate color rendering.
 */

export type FinalePartType =
  | 'shell' | 'comet' | 'mine' | 'cake' | 'candle' | 'fan' | 'gerb'
  | 'flame' | 'sfx' | 'light' | 'laser' | 'drone' | 'formation'
  | 'single_shot' | 'ground' | 'rocket' | 'waterfall' | 'strobe'
  | 'set_piece' | 'girandola' | 'cake_chained' | 'effect' | string;

export interface FinalePart {
  partNumber: string;
  qoh?: number;
  available?: number;
  description?: string;
  size?: string;
  internalDelay?: number;
  duration?: number;
  height?: number;
  numDevices?: number;
  color?: string;
  subtype?: string;
  vdl?: string;
  manufacturerPartNumber?: string;
  manufacturer?: string;
  partType?: FinalePartType;
  stdPrice?: number;
  stdLocation?: string;
  lockoutDefault?: number | string;
  numTubes?: number;
  category?: string;
  customPartField?: string;
  rackType?: string;
  partNotes?: string;
  dmxPatch?: string;
  exNumber?: string | number;
  ceNumber?: string | number;
  unNumber?: string | number;
  stdCost?: number;
  safetyDistance?: number;
  fuseDelay?: number;
  weight?: number;
  neq?: number;
  physicalSpecifications?: string;
  dmxFixtureDefinition?: string;
  ematches?: string;
}

export interface FinaleLibrary {
  manufacturer: string;
  slug: string;
  count: number;
  parts: FinalePart[];
}

/** All 35 canonical column keys, in authored order. */
export const FINALE_PART_COLUMNS = [
  'partNumber','qoh','available','description','size','internalDelay','duration',
  'height','numDevices','color','subtype','vdl','manufacturerPartNumber','manufacturer',
  'partType','stdPrice','stdLocation','lockoutDefault','numTubes','category',
  'customPartField','rackType','partNotes','dmxPatch','exNumber','ceNumber','unNumber',
  'stdCost','safetyDistance','fuseDelay','weight','neq','physicalSpecifications',
  'dmxFixtureDefinition','ematches',
] as const;

/** Numeric coercion targets when parsing XLSX. */
export const FINALE_NUMERIC_KEYS = new Set<string>([
  'qoh','available','internalDelay','duration','height','numDevices','stdPrice',
  'lockoutDefault','numTubes','exNumber','ceNumber','unNumber','stdCost',
  'safetyDistance','fuseDelay','weight','neq',
]);

/** Winda "Display Names" → canonical mapping (XLSX import). */
export const WINDA_DISPLAY_TO_CANONICAL: Record<string, string> = {
  'Product ID': 'partNumber',
  'Description': 'description',
  'Caliber': 'size',
  'Prefire time': 'internalDelay',
  'Duration': 'duration',
  'Effect height': 'height',
  'Chain number of devices': 'numDevices',
  'Effect Color': 'color',
  'Effect Sub Type': 'subtype',
  'VDL description': 'vdl',
  'Mfg product ID': 'manufacturerPartNumber',
  'Manufacturer': 'manufacturer',
  'Choreography tab': 'category',
  'Item price': 'stdPrice',
  'Std bin ID': 'stdLocation',
  'Hazard Default': 'lockoutDefault',
  'Rack Tubes': 'numTubes',
  'Category': 'partType',
  'Custom Part Field': 'customPartField',
  'Rack Type Default': 'rackType',
  'Notes': 'partNotes',
  'DMX Patch': 'dmxPatch',
  'EX Number': 'exNumber',
  'CE Number': 'ceNumber',
  'Hazardous material': 'unNumber',
  'Std accounting cost': 'stdCost',
  'Safety distance': 'safetyDistance',
  'Fuse delay': 'fuseDelay',
  'Weight per unit': 'weight',
  'NEQ per unit': 'neq',
};
