/**
 * ─── Showven Equipment Presets ──────────────────────────────────────
 * Real hardware specs from Showven product catalog.
 * Used to constrain SFX rendering to physical equipment limits.
 */

export type ShowvenCategory = 'flamer' | 'sparkular' | 'cryo' | 'confetti' | 'fog' | 'controller' | 'remote' | 'flyingDisplay' | 'laser' | 'infrastructure';

export interface ShowvenFlamerPreset {
  id: string;
  name: string;
  maxHeightM: number;
  nozzles: number;
  colorCount: number;
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
  dimensionsMM: [number, number, number];
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
  type: 'wired' | 'wireless' | 'dmx_relay' | 'dmx_console' | 'host_controller';
  protocol: string;
  wirelessRangeM?: number;
  wiredRangeM?: number;
  dualBand?: boolean;
  supportLTC?: boolean;
  description: string;
}

export interface ShowvenLaserPreset {
  id: string;
  name: string;
  outputW: number;
  wavelengthRGB: [number, number, number]; // nm
  scanningAngleDeg: number;
  scanRateKpps: number;
  beamDivergenceMrad: number;
  weightKg: number;
  ipRating: string;
  laserClass: 4;
  controlInterfaces: string[];  // DMX, ILDA, Ethernet, FB4, SD, Sound
  dmxChannels: number;
  description: string;
}

export interface ShowvenInfrastructurePreset {
  id: string;
  name: string;
  type: 'dmx_splitter' | 'dmx_relay' | 'power_distro' | 'adaptor';
  outputs: number;
  dmxChannels: number;
  hasEStop: boolean;
  weightKg: number;
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

// ── Controllers & Remotes ───────────────────────────────────────────

export const SHOWVEN_CONTROLLERS: ShowvenControllerPreset[] = [
  {
    id: 'pyroslave_x4', name: 'PyroSlave X4', channels: 4, type: 'wired', protocol: 'PBUS',
    wiredRangeM: 2000,
    description: '4-channel pyro firing module — wired PBUS',
  },
  {
    id: 'pyroslave_c16', name: 'PyroSlave C16', channels: 16, type: 'wireless', protocol: 'PBUS + Dual-band RF',
    wirelessRangeM: 600, wiredRangeM: 2000, dualBand: true,
    description: '16-cue firing module — dual-band wireless (433M/868M) + wired PBUS, quickplug & clamp connectors',
  },
  {
    id: 'pyromote', name: 'PyroMote', channels: 256, type: 'wireless', protocol: 'Dual-band RF 433M/868M',
    wirelessRangeM: 600, dualBand: true, supportLTC: true,
    description: 'Handheld firing controller — 5" touch screen, LTC timecode, manual/auto fire, audio sync',
  },
  {
    id: 'fxbutton', name: 'FXbutton', channels: 36, type: 'dmx_console', protocol: 'DMX512',
    description: 'Compact DMX console — rotary encoder, 5 preset firing modes, battery powered, 3/5-pin XLR',
  },
  {
    id: 'zk6200', name: 'ZK6200 Host Controller', channels: 18, type: 'host_controller', protocol: 'DMX512 + CAN + MIDI + LAN',
    description: 'Sparkular/Flamer host controller — 18 units, RDMX feedback, audio/MIDI trigger, SparkularEdit200',
  },
  {
    id: 'zk6300', name: 'ZK6300 Host Controller Pro', channels: 54, type: 'host_controller', protocol: 'DMX512 + CAN + MIDI + LAN',
    description: 'Pro host controller — 54 units, 8 files × 36000 lines, multi-controller LAN sync',
  },
  {
    id: 'fxmote', name: 'FXmote', channels: 8, type: 'wireless', protocol: 'RF 433MHz',
    wirelessRangeM: 300,
    description: 'Wireless SFX remote control — 8 channels',
  },
];

// ── Lasers (Maiman Series) ──────────────────────────────────────────

export const SHOWVEN_LASERS: ShowvenLaserPreset[] = [
  {
    id: 'maiman_30', name: 'Maiman 30W', outputW: 30,
    wavelengthRGB: [638, 520, 445], scanningAngleDeg: 30, scanRateKpps: 35,
    beamDivergenceMrad: 1.2, weightKg: 27, ipRating: 'IP65', laserClass: 4,
    controlInterfaces: ['FB4', 'DMX', 'ILDA', 'Ethernet', 'SD', 'Sound'],
    dmxChannels: 12,
    description: 'Full-colour RGB laser — 30W, ±30° scan, 35Kpps, TEC cooling, IP65',
  },
  {
    id: 'maiman_40', name: 'Maiman 40W', outputW: 40,
    wavelengthRGB: [638, 520, 445], scanningAngleDeg: 25, scanRateKpps: 30,
    beamDivergenceMrad: 1.2, weightKg: 29, ipRating: 'IP65', laserClass: 4,
    controlInterfaces: ['FB4', 'DMX', 'ILDA', 'Ethernet', 'SD', 'Sound'],
    dmxChannels: 12,
    description: 'Full-colour RGB laser — 40W, ±25° scan, 30Kpps, TEC cooling, IP65',
  },
  {
    id: 'maiman_60', name: 'Maiman 60W', outputW: 60,
    wavelengthRGB: [638, 520, 445], scanningAngleDeg: 20, scanRateKpps: 25,
    beamDivergenceMrad: 1.5, weightKg: 50, ipRating: 'IP65', laserClass: 4,
    controlInterfaces: ['FB4', 'DMX', 'ILDA', 'Ethernet', 'SD', 'Sound'],
    dmxChannels: 12,
    description: 'Full-colour RGB laser — 60W, ±20° scan, 25Kpps, TEC cooling, IP65, dual-layer housing',
  },
];

// ── Infrastructure (Splitters, Relays, Adaptors) ────────────────────

export const SHOWVEN_INFRASTRUCTURE: ShowvenInfrastructurePreset[] = [
  {
    id: 'dmx_splitter_8', name: 'DMX Splitter 8', type: 'dmx_splitter', outputs: 8,
    dmxChannels: 0, hasEStop: true, weightKg: 2.8, protocol: 'DMX512',
    description: '8-output DMX splitter — bidirectional with SHOWVEN devices, 1000V isolation, Neutrik connectors',
  },
  {
    id: 'dmx_relay_r12', name: 'DMX Relay R12', type: 'dmx_relay', outputs: 12,
    dmxChannels: 12, hasEStop: true, weightKg: 7, protocol: 'DMX512',
    description: '12-channel DMX relay — converts DMX to AC voltage output (10A/ch), for CO2 jets, confetti blasters',
  },
];

// ── Flying Displays (Filmbase) ──────────────────────────────────────

export interface ShowvenFlyingDisplayPreset {
  id: string;
  name: string;
  widthM: number;
  heightM: number;
  weightKg: number;
  pixelPitch: string;
  transparency: number;
  weightPerSqM: number;
  resolution: string;
  dmxChannels: number;
  description: string;
}

export const SHOWVEN_FLYING_DISPLAYS: ShowvenFlyingDisplayPreset[] = [
  {
    id: 'filmbase_fly78', name: 'Filmbase FLY78', widthM: 5, heightM: 15, weightKg: 48.4,
    pixelPitch: 'P30', transparency: 95, weightPerSqM: 250, resolution: '167x500',
    dmxChannels: 0, description: 'Transparent LED mesh flown by drones — 95% see-through, 250g/m²',
  },
  {
    id: 'filmbase_l8', name: 'Filmbase L8', widthM: 3, heightM: 10, weightKg: 22,
    pixelPitch: 'P40', transparency: 95, weightPerSqM: 250, resolution: '75x250',
    dmxChannels: 0, description: 'Compact flying LED display — drone-liftable transparent mesh',
  },
  {
    id: 'filmbase_fly78_p30', name: 'Filmbase FLY78 P30 Custom', widthM: 8, heightM: 20, weightKg: 96,
    pixelPitch: 'P30', transparency: 95, weightPerSqM: 250, resolution: '267x667',
    dmxChannels: 0, description: 'Large format flying display — multi-drone rigging required',
  },
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

export function getLaserPreset(id: string): ShowvenLaserPreset | undefined {
  return SHOWVEN_LASERS.find(l => l.id === id);
}

export function getInfrastructurePreset(id: string): ShowvenInfrastructurePreset | undefined {
  return SHOWVEN_INFRASTRUCTURE.find(i => i.id === id);
}

export function getAllShowvenEquipment() {
  return {
    flamers: SHOWVEN_FLAMERS,
    sparkulars: SHOWVEN_SPARKULARS,
    fog: SHOWVEN_FOG,
    confetti: SHOWVEN_CONFETTI,
    controllers: SHOWVEN_CONTROLLERS,
    lasers: SHOWVEN_LASERS,
    infrastructure: SHOWVEN_INFRASTRUCTURE,
    flyingDisplays: SHOWVEN_FLYING_DISPLAYS,
  };
}

// ── Showven → Effect Pipeline Mapper ────────────────────────────────

export interface ShowvenEffectConfig {
  effectType: string;
  duration: number;
  height: number;
  spread: number;
  presetId: string;
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
  if (category === 'laser') {
    const l = getLaserPreset(presetId);
    if (!l) return null;
    return {
      effectType: 'laser',
      duration: 60,
      height: 0,
      spread: l.scanningAngleDeg * 2,
      presetId: l.id,
      category,
      dmxChannels: l.dmxChannels,
      colorMode: 'multi',
    };
  }
  return null;
}
