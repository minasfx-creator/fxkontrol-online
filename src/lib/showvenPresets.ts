/**
 * ─── Showven Equipment Presets ──────────────────────────────────────
 * Real hardware specs from Showven product catalog.
 * Used to constrain SFX rendering to physical equipment limits.
 */

export type ShowvenCategory = 'flamer' | 'sparkular' | 'cryo' | 'confetti' | 'fog' | 'controller' | 'remote';

export interface ShowvenFlamerPreset {
  id: string;
  name: string;
  maxHeightM: number;
  nozzles: number;
  colorCount: number;      // 0 = no color, 5 = RGBWY
  fuelCapacityL: number;
  burnTimeMin: number;
  dmxChannels: number;
  weightKg: number;
  ipRating: string;
  description: string;
}

export interface ShowvenSparkularPreset {
  id: string;
  name: string;
  maxHeightM: number;
  sparkType: 'vertical' | 'circular' | 'waterfall' | 'wheel' | 'blast' | 'mobile';
  granuleCapacityG: number;
  dmxChannels: number;
  weightKg: number;
  sparkColor: 'gold' | 'silver' | 'multi';
  description: string;
}

export interface ShowvenFogPreset {
  id: string;
  name: string;
  outputCuftMin: number;
  fogType: 'low' | 'standard' | 'haze';
  fluidCapacityL: number;
  heaterWatts: number;
  weightKg: number;
  dimensionsMM: [number, number, number]; // W x D x H
  dmxChannels: number;
  description: string;
}

export interface ShowvenConfettiPreset {
  id: string;
  name: string;
  type: 'shot' | 'blower';
  rangeM: number;
  loadCapacity: string;
  dmxChannels: number;
  weightKg: number;
  description: string;
}

export interface ShowvenControllerPreset {
  id: string;
  name: string;
  channels: number;
  type: 'wired' | 'wireless' | 'dmx_relay';
  protocol: string;
  description: string;
}

// ── Flamers ─────────────────────────────────────────────────────────

export const SHOWVEN_FLAMERS: ShowvenFlamerPreset[] = [
  {
    id: 'cflamer', name: 'cFlamer', maxHeightM: 10, nozzles: 1, colorCount: 5,
    fuelCapacityL: 5.3, burnTimeMin: 8, dmxChannels: 8, weightKg: 18, ipRating: 'IP54',
    description: 'Color flame projector — 5 LPG color cartridges (R/G/B/W/Y)',
  },
  {
    id: 'uflamer_max', name: 'uFlamer Max', maxHeightM: 20, nozzles: 1, colorCount: 0,
    fuelCapacityL: 17, burnTimeMin: 15, dmxChannels: 4, weightKg: 35, ipRating: 'IP54',
    description: 'Ultra-height single-color LPG flame projector',
  },
  {
    id: 'cflamer_volcano', name: 'cFlamer Volcano', maxHeightM: 10, nozzles: 5, colorCount: 5,
    fuelCapacityL: 5.3, burnTimeMin: 5, dmxChannels: 12, weightKg: 22, ipRating: 'IP54',
    description: '5-nozzle color flame array for wide flame walls',
  },
  {
    id: 'uflamer', name: 'uFlamer', maxHeightM: 6, nozzles: 1, colorCount: 0,
    fuelCapacityL: 5.3, burnTimeMin: 12, dmxChannels: 4, weightKg: 15, ipRating: 'IP54',
    description: 'Compact single-color LPG flame projector',
  },
];

// ── Sparkulars ──────────────────────────────────────────────────────

export const SHOWVEN_SPARKULARS: ShowvenSparkularPreset[] = [
  {
    id: 'sparkular_jet_ii', name: 'Sparkular Jet II', maxHeightM: 5, sparkType: 'vertical',
    granuleCapacityG: 200, dmxChannels: 4, weightKg: 8, sparkColor: 'gold',
    description: 'Cold spark fountain — indoor-safe titanium granules',
  },
  {
    id: 'sparkular_cyclone_ii', name: 'Sparkular Cyclone II', maxHeightM: 4, sparkType: 'circular',
    granuleCapacityG: 200, dmxChannels: 6, weightKg: 10, sparkColor: 'gold',
    description: 'Rotating cold spark effect — 360° dispersal',
  },
  {
    id: 'sparkular_wheel', name: 'Sparkular Wheel', maxHeightM: 3, sparkType: 'wheel',
    granuleCapacityG: 150, dmxChannels: 4, weightKg: 12, sparkColor: 'gold',
    description: 'Spinning wheel of cold sparks',
  },
  {
    id: 'sparkular_waverfall', name: 'Sparkular WaverFall', maxHeightM: 5, sparkType: 'waterfall',
    granuleCapacityG: 300, dmxChannels: 6, weightKg: 14, sparkColor: 'silver',
    description: 'Cascading waterfall of cold sparks from elevation',
  },
  {
    id: 'sparkular_blaster', name: 'Sparkular Blaster', maxHeightM: 6, sparkType: 'blast',
    granuleCapacityG: 250, dmxChannels: 4, weightKg: 9, sparkColor: 'gold',
    description: 'Explosive burst of cold sparks',
  },
  {
    id: 'sparkular_mobile', name: 'Sparkular Mobile', maxHeightM: 3, sparkType: 'mobile',
    granuleCapacityG: 100, dmxChannels: 2, weightKg: 4, sparkColor: 'gold',
    description: 'Battery-powered portable cold spark unit',
  },
];

// ── Fog Machines ────────────────────────────────────────────────────

export const SHOWVEN_FOG: ShowvenFogPreset[] = [
  {
    id: 'creeper_aq', name: 'Creeper AQ', outputCuftMin: 10000, fogType: 'low',
    fluidCapacityL: 5, heaterWatts: 1200, weightKg: 15,
    dimensionsMM: [460, 300, 324], dmxChannels: 4,
    description: 'Low-fog machine — floor-hugging effect using ice/water cooling',
  },
  {
    id: 'pro_fog', name: 'PRO FOG', outputCuftMin: 30000, fogType: 'standard',
    fluidCapacityL: 10, heaterWatts: 3000, weightKg: 28,
    dimensionsMM: [580, 350, 400], dmxChannels: 6,
    description: 'High-output industrial fog machine',
  },
];

// ── Confetti ────────────────────────────────────────────────────────

export const SHOWVEN_CONFETTI: ShowvenConfettiPreset[] = [
  {
    id: 'easyfetti_shot', name: 'easyFetti Shot', type: 'shot', rangeM: 12,
    loadCapacity: '1 cartridge', dmxChannels: 2, weightKg: 5,
    description: 'Single-shot CO2 confetti cannon',
  },
  {
    id: 'ufetti_blower', name: 'uFetti Blower', type: 'blower', rangeM: 8,
    loadCapacity: '5kg hopper', dmxChannels: 4, weightKg: 12,
    description: 'Continuous confetti blower with hopper',
  },
];

// ── Controllers ─────────────────────────────────────────────────────

export const SHOWVEN_CONTROLLERS: ShowvenControllerPreset[] = [
  { id: 'pyroslave_x4', name: 'PyroSlave X4', channels: 4, type: 'wired', protocol: 'E-match', description: '4-channel pyro firing module' },
  { id: 'pyroslave_c16', name: 'PyroSlave C16', channels: 16, type: 'wired', protocol: 'E-match', description: '16-channel pyro firing module' },
  { id: 'fxmote', name: 'FXmote', channels: 8, type: 'wireless', protocol: 'RF 433MHz', description: 'Wireless SFX remote control' },
  { id: 'pyromote', name: 'PyroMote', channels: 12, type: 'wireless', protocol: 'RF 868MHz', description: 'Long-range pyro wireless controller' },
  { id: 'fxbutton', name: 'FXbutton', channels: 1, type: 'wireless', protocol: 'RF', description: 'Single-button wireless trigger' },
  { id: 'dmx_relay_r12', name: 'DMX Relay R12', channels: 12, type: 'dmx_relay', protocol: 'DMX512', description: '12-channel DMX relay switch' },
];

// ── Lookup Helpers ──────────────────────────────────────────────────

export function getFlamerPreset(id: string): ShowvenFlamerPreset | undefined {
  return SHOWVEN_FLAMERS.find(f => f.id === id);
}

export function getSparkularPreset(id: string): ShowvenSparkularPreset | undefined {
  return SHOWVEN_SPARKULARS.find(s => s.id === id);
}

export function getFogPreset(id: string): ShowvenFogPreset | undefined {
  return SHOWVEN_FOG.find(f => f.id === id);
}

export function getAllShowvenEquipment() {
  return {
    flamers: SHOWVEN_FLAMERS,
    sparkulars: SHOWVEN_SPARKULARS,
    fog: SHOWVEN_FOG,
    confetti: SHOWVEN_CONFETTI,
    controllers: SHOWVEN_CONTROLLERS,
  };
}

// ── Showven → Effect Pipeline Mapper ────────────────────────────────

export interface ShowvenEffectConfig {
  effectType: string;        // maps to PyroEffectType
  duration: number;          // seconds
  height: number;            // meters
  spread: number;            // degrees
  presetId: string;          // original showven preset id
  category: ShowvenCategory;
  dmxChannels: number;
  colorMode: 'none' | 'single' | 'multi';
}

export function showvenToEffect(presetId: string, category: ShowvenCategory): ShowvenEffectConfig | null {
  if (category === 'flamer') {
    const p = getFlamerPreset(presetId);
    if (!p) return null;
    return {
      effectType: 'flame',
      duration: p.burnTimeMin * 60,
      height: p.maxHeightM,
      spread: p.nozzles > 1 ? 60 : 15,
      presetId: p.id,
      category,
      dmxChannels: p.dmxChannels,
      colorMode: p.colorCount > 0 ? 'multi' : 'none',
    };
  }
  if (category === 'sparkular') {
    const p = getSparkularPreset(presetId);
    if (!p) return null;
    return {
      effectType: 'sparkular',
      duration: 30,
      height: p.maxHeightM,
      spread: p.sparkType === 'circular' ? 360 : p.sparkType === 'waterfall' ? 90 : 20,
      presetId: p.id,
      category,
      dmxChannels: p.dmxChannels,
      colorMode: p.sparkColor === 'multi' ? 'multi' : 'single',
    };
  }
  if (category === 'fog') {
    const p = getFogPreset(presetId);
    if (!p) return null;
    return {
      effectType: 'fog_low',
      duration: 120,
      height: p.fogType === 'low' ? 0.3 : 3,
      spread: 180,
      presetId: p.id,
      category,
      dmxChannels: p.dmxChannels,
      colorMode: 'none',
    };
  }
  if (category === 'confetti') {
    const c = SHOWVEN_CONFETTI.find(x => x.id === presetId);
    if (!c) return null;
    return {
      effectType: 'confetti',
      duration: c.type === 'blower' ? 30 : 2,
      height: c.rangeM,
      spread: c.type === 'blower' ? 45 : 30,
      presetId: c.id,
      category,
      dmxChannels: c.dmxChannels,
      colorMode: 'multi',
    };
  }
  return null;
}
