/**
 * DMX512 / Art-Net Virtual Engine
 * Manages fixture patches, universes, and RGB channel mapping for drone LED control.
 *
 * DMX Universe: 512 channels
 * Each drone fixture: 4 channels (R, G, B, W) or 3 channels (R, G, B)
 * Art-Net supports 32,768 universes
 *
 * Extended DMX Attributes from UE5 DMXPrevis config:
 * Pan, Tilt, Gobo, Frost, Shaper, Color Wheel, Zoom, Focus, Prism, etc.
 */

// ═══ UE5 DMXPrevis-compatible Fixture Attribute Definitions ═══
export type DMXAttributeCategory =
  | 'intensity'
  | 'color'
  | 'position'
  | 'beam'
  | 'gobo'
  | 'effects'
  | 'control'
  | 'shaper';

export interface DMXAttributeDefinition {
  name: string;
  category: DMXAttributeCategory;
  channelCount: number;       // 1 for 8-bit, 2 for 16-bit
  defaultValue: number;       // 0-255 (8-bit) or 0-65535 (16-bit)
  minValue: number;
  maxValue: number;
  description: string;
}

/**
 * Complete DMX attribute library — synced from UE5 DMXPrevis DefaultEngine config.
 * Covers all standard fixture attribute types from moving heads, LED bars, SFX, etc.
 */
export const DMX_ATTRIBUTE_LIBRARY: Record<string, DMXAttributeDefinition> = {
  // ── Intensity ──
  Dimmer:           { name: 'Dimmer',           category: 'intensity', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Master dimmer' },
  DimmerFine:       { name: 'DimmerFine',       category: 'intensity', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Fine dimmer (16-bit LSB)' },
  Strobe:           { name: 'Strobe',           category: 'intensity', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Strobe speed' },
  StrobeDuration:   { name: 'StrobeDuration',   category: 'intensity', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Strobe pulse duration' },
  StrobeMode:       { name: 'StrobeMode',       category: 'intensity', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Strobe mode selector' },

  // ── Color ──
  Red:              { name: 'Red',              category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Red channel' },
  Green:            { name: 'Green',            category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Green channel' },
  Blue:             { name: 'Blue',             category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Blue channel' },
  White:            { name: 'White',            category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'White channel' },
  Amber:            { name: 'Amber',            category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Amber channel' },
  UV:               { name: 'UV',               category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'UV/Blacklight channel' },
  Lime:             { name: 'Lime',             category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Lime channel' },
  Cyan:             { name: 'Cyan',             category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Cyan channel' },
  Magenta:          { name: 'Magenta',          category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Magenta channel' },
  CTO:              { name: 'CTO',              category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Color Temperature Orange (warm)' },
  CTB:              { name: 'CTB',              category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Color Temperature Blue (cool)' },
  ColorWheel:       { name: 'ColorWheel',       category: 'color', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Color wheel position' },
  ColorWheelSpin:   { name: 'ColorWheelSpin',   category: 'color', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Color wheel rotation speed' },

  // ── Position (Pan / Tilt) ──
  Pan:              { name: 'Pan',              category: 'position', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Pan coarse (0-540°)' },
  PanFine:          { name: 'PanFine',          category: 'position', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Pan fine (16-bit LSB)' },
  Tilt:             { name: 'Tilt',             category: 'position', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Tilt coarse (0-270°)' },
  TiltFine:         { name: 'TiltFine',         category: 'position', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Tilt fine (16-bit LSB)' },
  PanTiltSpeed:     { name: 'PanTiltSpeed',     category: 'position', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Pan/Tilt movement speed' },

  // ── Beam ──
  Zoom:             { name: 'Zoom',             category: 'beam', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Beam zoom (narrow → wide)' },
  ZoomFine:         { name: 'ZoomFine',         category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Zoom fine (16-bit LSB)' },
  Focus:            { name: 'Focus',            category: 'beam', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Focus near ↔ far' },
  FocusFine:        { name: 'FocusFine',        category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Focus fine (16-bit LSB)' },
  Iris:             { name: 'Iris',             category: 'beam', channelCount: 1, defaultValue: 255, minValue: 0, maxValue: 255, description: 'Iris aperture' },
  IrisFine:         { name: 'IrisFine',         category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Iris fine' },
  Frost:            { name: 'Frost',            category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Frost filter (soft edge)' },
  FrostFine:        { name: 'FrostFine',        category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Frost fine' },
  Prism:            { name: 'Prism',            category: 'beam', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Prism insert/rotation' },
  PrismRotation:    { name: 'PrismRotation',    category: 'beam', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Prism rotation speed' },

  // ── Gobo ──
  Gobo1:            { name: 'Gobo1',            category: 'gobo', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Gobo wheel 1 selection' },
  Gobo1Rotation:    { name: 'Gobo1Rotation',    category: 'gobo', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Gobo 1 rotation speed' },
  Gobo1Fine:        { name: 'Gobo1Fine',        category: 'gobo', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Gobo 1 rotation fine' },
  Gobo2:            { name: 'Gobo2',            category: 'gobo', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Gobo wheel 2 selection' },
  Gobo2Rotation:    { name: 'Gobo2Rotation',    category: 'gobo', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Gobo 2 rotation speed' },

  // ── Shaper / Framing ──
  ShaperRotation:   { name: 'ShaperRotation',   category: 'shaper', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Framing shutter rotation' },
  ShaperBlade1A:    { name: 'ShaperBlade1A',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 1 position A' },
  ShaperBlade1B:    { name: 'ShaperBlade1B',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 1 position B' },
  ShaperBlade2A:    { name: 'ShaperBlade2A',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 2 position A' },
  ShaperBlade2B:    { name: 'ShaperBlade2B',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 2 position B' },
  ShaperBlade3A:    { name: 'ShaperBlade3A',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 3 position A' },
  ShaperBlade3B:    { name: 'ShaperBlade3B',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 3 position B' },
  ShaperBlade4A:    { name: 'ShaperBlade4A',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 4 position A' },
  ShaperBlade4B:    { name: 'ShaperBlade4B',    category: 'shaper', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Blade 4 position B' },

  // ── Effects ──
  EffectWheel:      { name: 'EffectWheel',      category: 'effects', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Animation/effect wheel' },
  EffectSpeed:      { name: 'EffectSpeed',      category: 'effects', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Effect animation speed' },
  MacroEffect:      { name: 'MacroEffect',      category: 'effects', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Built-in macro/effect program' },

  // ── Control ──
  Control:          { name: 'Control',          category: 'control', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Fixture reset/lamp control' },
  FanSpeed:         { name: 'FanSpeed',         category: 'control', channelCount: 1, defaultValue: 0, minValue: 0, maxValue: 255, description: 'Cooling fan speed' },

  // ── Pyro / SFX (from UE5 DMXPrevis config) ──
  Burst:            { name: 'Burst',            category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Pyro burst trigger' },
  Launch:           { name: 'Launch',           category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Pyro launch trigger' },
  Velocity:         { name: 'Velocity',         category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Launch velocity (0-255)' },
  Angle:            { name: 'Angle',            category: 'effects', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Launch angle (0-180°)' },
  NumBeams:         { name: 'NumBeams',         category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Number of beams/stars' },
  X:                { name: 'X',                category: 'position', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Position X' },
  Y:                { name: 'Y',                category: 'position', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Position Y' },
  Z:                { name: 'Z',                category: 'position', channelCount: 1, defaultValue: 128, minValue: 0, maxValue: 255, description: 'Position Z' },

  // ── Water Fountain (from DMXLib_WaterFountain) ──
  WaterPressure:    { name: 'WaterPressure',    category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Water pump pressure' },
  WaterHeight:      { name: 'WaterHeight',      category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Fountain jet height' },
  WaterSpread:      { name: 'WaterSpread',      category: 'effects', channelCount: 1, defaultValue: 0,   minValue: 0, maxValue: 255, description: 'Spray spread angle' },
};

/**
 * Fixture profile template — defines which attributes a fixture type uses.
 */
export interface DMXFixtureProfile {
  name: string;
  manufacturer: string;
  category: 'moving-head' | 'moving-mirror' | 'led-bar' | 'strobe' | 'laser' | 'sfx' | 'drone' | 'wash' | 'spot' | 'beam' | 'matrix' | 'toner' | 'audience';
  attributes: string[];   // keys from DMX_ATTRIBUTE_LIBRARY
  channelCount: number;
}

/** Pre-built fixture profiles matching UE5 DMXPrevis defaults */
export const DMX_FIXTURE_PROFILES: Record<string, DMXFixtureProfile> = {
  'generic-rgb': {
    name: 'Generic RGB',
    manufacturer: 'Generic',
    category: 'led-bar',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue'],
    channelCount: 4,
  },
  'generic-rgbw': {
    name: 'Generic RGBW',
    manufacturer: 'Generic',
    category: 'led-bar',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White'],
    channelCount: 5,
  },
  'moving-head-spot': {
    name: 'Moving Head Spot',
    manufacturer: 'Generic',
    category: 'spot',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'DimmerFine', 'Strobe', 'ColorWheel', 'Gobo1', 'Gobo1Rotation', 'Gobo2', 'Prism', 'PrismRotation', 'Focus', 'Zoom', 'Frost', 'Iris', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Control'],
    channelCount: 24,
  },
  'moving-head-wash': {
    name: 'Moving Head Wash',
    manufacturer: 'Generic',
    category: 'wash',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'DimmerFine', 'Strobe', 'Red', 'Green', 'Blue', 'White', 'Amber', 'UV', 'CTO', 'Zoom', 'Control'],
    channelCount: 17,
  },
  'moving-head-beam': {
    name: 'Moving Head Beam',
    manufacturer: 'Generic',
    category: 'beam',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'Strobe', 'ColorWheel', 'Gobo1', 'Gobo1Rotation', 'Prism', 'PrismRotation', 'Frost', 'Focus', 'Zoom', 'Control'],
    channelCount: 16,
  },
  'led-wash-rgbwa-uv': {
    name: 'LED Wash RGBWA+UV',
    manufacturer: 'Generic',
    category: 'wash',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'Amber', 'UV', 'Strobe', 'MacroEffect', 'EffectSpeed'],
    channelCount: 10,
  },
  'framing-spot': {
    name: 'Framing Spot (Shaper)',
    manufacturer: 'Generic',
    category: 'spot',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'DimmerFine', 'Strobe', 'ColorWheel', 'CTO', 'Gobo1', 'Gobo1Rotation', 'Gobo1Fine', 'Prism', 'PrismRotation', 'Focus', 'FocusFine', 'Zoom', 'ZoomFine', 'Iris', 'Frost', 'ShaperRotation', 'ShaperBlade1A', 'ShaperBlade1B', 'ShaperBlade2A', 'ShaperBlade2B', 'ShaperBlade3A', 'ShaperBlade3B', 'ShaperBlade4A', 'ShaperBlade4B', 'Red', 'Green', 'Blue', 'White', 'Control'],
    channelCount: 35,
  },
  'drone-led': {
    name: 'Drone LED',
    manufacturer: 'Custom',
    category: 'drone',
    attributes: ['Red', 'Green', 'Blue', 'White'],
    channelCount: 4,
  },
  'sfx-flame': {
    name: 'SFX Flame Machine',
    manufacturer: 'Showven',
    category: 'sfx',
    attributes: ['Dimmer', 'EffectWheel', 'EffectSpeed', 'Control'],
    channelCount: 4,
  },
  'sfx-cryo': {
    name: 'SFX Cryo Jet',
    manufacturer: 'Showven',
    category: 'sfx',
    attributes: ['Dimmer', 'EffectWheel', 'Control'],
    channelCount: 3,
  },
  // ── 12 New UE5 Blueprint-derived Profiles ──
  'spot-mh-standard': {
    name: 'Spot MH Standard',
    manufacturer: 'Generic',
    category: 'spot',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'DimmerFine', 'Strobe', 'ColorWheel', 'Gobo1', 'Gobo1Rotation', 'Prism', 'Focus', 'Zoom', 'Iris', 'Frost', 'Red', 'Green', 'Blue', 'White'],
    channelCount: 20,
  },
  'spot-mh-hq': {
    name: 'Spot MH HQ (Shaper)',
    manufacturer: 'Generic',
    category: 'spot',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'PanTiltSpeed', 'Dimmer', 'DimmerFine', 'Strobe', 'ColorWheel', 'CTO', 'Gobo1', 'Gobo1Rotation', 'Gobo1Fine', 'Gobo2', 'Gobo2Rotation', 'Prism', 'PrismRotation', 'Focus', 'FocusFine', 'Zoom', 'ZoomFine', 'Iris', 'Frost', 'ShaperRotation', 'ShaperBlade1A', 'ShaperBlade1B', 'ShaperBlade2A', 'ShaperBlade2B', 'ShaperBlade3A', 'ShaperBlade3B', 'ShaperBlade4A', 'ShaperBlade4B'],
    channelCount: 32,
  },
  'audience-toner': {
    name: 'Audience Toner',
    manufacturer: 'Generic',
    category: 'toner',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Strobe', 'Zoom'],
    channelCount: 8,
  },
  'stadium-light': {
    name: 'Stadium Light',
    manufacturer: 'Generic',
    category: 'audience',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Zoom', 'Strobe', 'MacroEffect'],
    channelCount: 9,
  },
  'static-scene-light': {
    name: 'Static Scene Light',
    manufacturer: 'Generic',
    category: 'spot',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Zoom'],
    channelCount: 7,
  },
  'static-toner': {
    name: 'Static Toner',
    manufacturer: 'Generic',
    category: 'toner',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO'],
    channelCount: 6,
  },
  'toner-beam': {
    name: 'Toner with Beam',
    manufacturer: 'Generic',
    category: 'beam',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Zoom', 'Focus', 'Frost'],
    channelCount: 9,
  },
  'led-matrix-5x1': {
    name: 'LED Matrix 5x1',
    manufacturer: 'Generic',
    category: 'matrix',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'EffectWheel', 'EffectSpeed'],
    channelCount: 7,
  },
  'led-matrix-panel': {
    name: 'LED Matrix Panel',
    manufacturer: 'Generic',
    category: 'matrix',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'MacroEffect', 'EffectSpeed', 'Strobe'],
    channelCount: 8,
  },
  'strobe-high-power': {
    name: 'High Power Strobe',
    manufacturer: 'Generic',
    category: 'strobe',
    attributes: ['Dimmer', 'Strobe', 'StrobeDuration', 'StrobeMode', 'Red', 'Green', 'Blue', 'White'],
    channelCount: 8,
  },
  'wash-led-par': {
    name: 'Wash LED PAR',
    manufacturer: 'Generic',
    category: 'wash',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'Amber', 'UV', 'Strobe', 'Zoom'],
    channelCount: 9,
  },
  'wash-spotlight': {
    name: 'Wash Spotlight',
    manufacturer: 'Generic',
    category: 'wash',
    attributes: ['Dimmer', 'DimmerFine', 'Red', 'Green', 'Blue', 'White', 'CTO', 'Zoom', 'ZoomFine', 'Strobe'],
    channelCount: 10,
  },
  // ── UE5 Pyro / Firework DMX Profiles ──
  'sfx-pyro-dmx': {
    name: 'SFX Pyro DMX',
    manufacturer: 'FXK',
    category: 'sfx',
    attributes: ['Dimmer', 'Burst', 'Launch', 'Velocity', 'Angle', 'NumBeams', 'Red', 'Green', 'Blue'],
    channelCount: 9,
  },
  'sfx-firework-dmx': {
    name: 'SFX Firework DMX',
    manufacturer: 'FXK',
    category: 'sfx',
    attributes: ['Dimmer', 'Launch', 'Burst', 'Velocity', 'Angle', 'NumBeams', 'Red', 'Green', 'Blue', 'X', 'Y', 'Z'],
    channelCount: 12,
  },
  // ── Moving Mirror ──
  'moving-mirror': {
    name: 'Moving Mirror',
    manufacturer: 'Generic',
    category: 'moving-mirror',
    attributes: ['Pan', 'PanFine', 'Tilt', 'TiltFine', 'Dimmer', 'Strobe', 'ColorWheel', 'Gobo1', 'Focus', 'Control'],
    channelCount: 10,
  },
  // ── DMX Point Light (from BP_DMXPointLight) ──
  'dmx-point-light': {
    name: 'DMX Point Light',
    manufacturer: 'Generic',
    category: 'wash',
    attributes: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO'],
    channelCount: 6,
  },
  // ── Water Fountain (from DMXLib_WaterFountain) ──
  'sfx-water-fountain': {
    name: 'SFX Water Fountain',
    manufacturer: 'FXK',
    category: 'sfx',
    attributes: ['Dimmer', 'WaterPressure', 'WaterHeight', 'WaterSpread', 'Red', 'Green', 'Blue', 'EffectWheel', 'EffectSpeed'],
    channelCount: 9,
  },
};

// ── UE5 Blueprint → Profile Mapping ──
export const UE5_BLUEPRINT_MAP: Record<string, string> = {
  'BP_SpotMH1_v2': 'spot-mh-standard',
  'BP_SpotMH2_v2': 'spot-mh-standard',
  'BP_SpotMH2_v2_HQ': 'spot-mh-hq',
  'BP_WashMH1_v2': 'moving-head-wash',
  'BP_WashMH2': 'moving-head-wash',
  'BP_WashLED_v2': 'wash-led-par',
  'BP_WashSL1_v2': 'wash-spotlight',
  'BP_Static_SceneLight': 'static-scene-light',
  'BP_Static_Toner': 'static-toner',
  'BP_TonerWBeam': 'toner-beam',
  'BP_Audience_Toner': 'audience-toner',
  'BP_StadiumLights': 'stadium-light',
  'BP_StaticMatrix_5x1': 'led-matrix-5x1',
  'BP_StaticMatrix_NoBorder': 'led-matrix-panel',
  'BP_StaticMatrix_v2': 'led-matrix-panel',
  'BP_Strobe1_v3': 'strobe-high-power',
  'BP_Sphere': 'generic-rgbw',
  'BP_Firework_v2': 'sfx-firework-dmx',
  'BP_Pyro_v4': 'sfx-pyro-dmx',
  'BP_Laser_Extended': 'generic-rgb',
  'DMXLib_v4': 'generic-rgbw',
  // ── From BP uploads ──
  'BP_DMX_Send_Receive': 'generic-rgbw',
  'BP_DMXPointLight': 'dmx-point-light',
  'BP_FountainLight': 'sfx-water-fountain',
  'BP_PixelMappingManager': 'led-matrix-panel',
  'BP_DownSampleSceneCapture': 'generic-rgbw',
  'DMXLib_Fixtures': 'generic-rgbw',
  'DMXLib_PixelMapping': 'led-matrix-panel',
  'DMXLib_WaterFountain': 'sfx-water-fountain',
  'DMXPM_PixelMap': 'led-matrix-panel',
};

// ── Strobe Curve Tables ──
export interface StrobeCurve {
  source: string;
  minHz: number;
  maxHz: number;
  profile: string;
}

export const STROBE_CURVES: Record<string, StrobeCurve> = {
  'stadium': { source: 'StadiumLights_Strobe_Table', minHz: 1, maxHz: 25, profile: 'stadium-light' },
  'static-scene': { source: 'StaticScene_Strobe_Table', minHz: 1, maxHz: 20, profile: 'static-scene-light' },
  'strobe-rgb': { source: 'StrobeRGB_Strobe_Table', minHz: 1, maxHz: 30, profile: 'strobe-high-power' },
  'wash-mh1': { source: 'WashMH1_Strobe_Table', minHz: 1, maxHz: 15, profile: 'moving-head-wash' },
  'wash-mh2': { source: 'WashMH2_Strobe_Table', minHz: 1, maxHz: 15, profile: 'moving-head-wash' },
};

// ── Gobo Textures ──
export interface GoboTexture {
  source: string;
  label: string;
  variant: 'clean' | 'frosted';
}

export const GOBO_TEXTURES: Record<string, GoboTexture> = {
  'gobo-disk01-clean': { source: 'T_GoboDisk01_Clean', label: 'Gobo Disk 01 (Clean)', variant: 'clean' },
  'gobo-disk01-frosted': { source: 'T_GoboDisk01_Frosted', label: 'Gobo Disk 01 (Frosted)', variant: 'frosted' },
};

export interface DMXFixture {
  id: string;
  label: string;
  universe: number;
  startChannel: number;  // 1-512
  channelCount: number;  // 3 (RGB) or 4 (RGBW) or profile-based
  droneIndex: number;    // maps to drone in formation
  profileId?: string;    // optional reference to DMX_FIXTURE_PROFILES
}

export interface DMXUniverse {
  id: number;
  label: string;
  channels: Uint8Array; // 512 channels, values 0-255
  fixtures: DMXFixture[];
}

export interface DMXKeyframe {
  time: number;       // seconds
  fixtureId: string;
  r: number;          // 0-255
  g: number;          // 0-255
  b: number;          // 0-255
  w?: number;         // 0-255 (optional white)
}

export interface DMXShow {
  universes: DMXUniverse[];
  keyframes: DMXKeyframe[];
  fps: number;        // DMX refresh rate (default: 44 Hz)
}

/**
 * Auto-patch drones as DMX fixtures across universes.
 * Each drone gets 4 channels (RGBW). Max 128 fixtures per universe (512/4).
 */
export function autoPatchDrones(
  droneCount: number,
  channelsPerFixture = 4,
  startUniverse = 1,
  prefix = 'Drone',
): DMXUniverse[] {
  const fixturesPerUniverse = Math.floor(512 / channelsPerFixture);
  const universeCount = Math.ceil(droneCount / fixturesPerUniverse);
  const universes: DMXUniverse[] = [];

  let droneIdx = 0;

  for (let u = 0; u < universeCount; u++) {
    const fixturesInThis = Math.min(fixturesPerUniverse, droneCount - droneIdx);
    const fixtures: DMXFixture[] = [];

    for (let f = 0; f < fixturesInThis; f++) {
      fixtures.push({
        id: `dmx-${startUniverse + u}-${f + 1}`,
        label: `${prefix} ${droneIdx + 1}`,
        universe: startUniverse + u,
        startChannel: f * channelsPerFixture + 1,
        channelCount: channelsPerFixture,
        droneIndex: droneIdx,
        profileId: 'drone-led',
      });
      droneIdx++;
    }

    universes.push({
      id: startUniverse + u,
      label: `Universe ${startUniverse + u}`,
      channels: new Uint8Array(512),
      fixtures,
    });
  }

  return universes;
}

/**
 * Auto-patch fixtures from a profile across universes.
 */
export function autoPatchFixtures(
  fixtureCount: number,
  profileId: string,
  startUniverse = 1,
  prefix?: string,
): DMXUniverse[] {
  const profile = DMX_FIXTURE_PROFILES[profileId];
  if (!profile) return [];

  const channelsPerFixture = profile.channelCount;
  const fixturesPerUniverse = Math.floor(512 / channelsPerFixture);
  const universeCount = Math.ceil(fixtureCount / fixturesPerUniverse);
  const universes: DMXUniverse[] = [];
  const label = prefix || profile.name;

  let idx = 0;
  for (let u = 0; u < universeCount; u++) {
    const fixturesInThis = Math.min(fixturesPerUniverse, fixtureCount - idx);
    const fixtures: DMXFixture[] = [];

    for (let f = 0; f < fixturesInThis; f++) {
      fixtures.push({
        id: `dmx-${startUniverse + u}-${f + 1}`,
        label: `${label} ${idx + 1}`,
        universe: startUniverse + u,
        startChannel: f * channelsPerFixture + 1,
        channelCount: channelsPerFixture,
        droneIndex: idx,
        profileId,
      });
      idx++;
    }

    universes.push({
      id: startUniverse + u,
      label: `Universe ${startUniverse + u}`,
      channels: new Uint8Array(512),
      fixtures,
    });
  }

  return universes;
}

/**
 * Set fixture color in the universe channel buffer.
 */
export function setFixtureColor(
  universe: DMXUniverse,
  fixture: DMXFixture,
  r: number, g: number, b: number, w = 0,
): void {
  const ch = fixture.startChannel - 1; // 0-indexed
  universe.channels[ch] = Math.max(0, Math.min(255, Math.round(r)));
  universe.channels[ch + 1] = Math.max(0, Math.min(255, Math.round(g)));
  universe.channels[ch + 2] = Math.max(0, Math.min(255, Math.round(b)));
  if (fixture.channelCount >= 4) {
    universe.channels[ch + 3] = Math.max(0, Math.min(255, Math.round(w)));
  }
}

/**
 * Get fixture color from the universe channel buffer.
 */
export function getFixtureColor(universe: DMXUniverse, fixture: DMXFixture): { r: number; g: number; b: number; w: number } {
  const ch = fixture.startChannel - 1;
  return {
    r: universe.channels[ch],
    g: universe.channels[ch + 1],
    b: universe.channels[ch + 2],
    w: fixture.channelCount >= 4 ? universe.channels[ch + 3] : 0,
  };
}

/**
 * Set a named attribute on a fixture (requires profile).
 */
export function setFixtureAttribute(
  universe: DMXUniverse,
  fixture: DMXFixture,
  attributeName: string,
  value: number,
): void {
  if (!fixture.profileId) return;
  const profile = DMX_FIXTURE_PROFILES[fixture.profileId];
  if (!profile) return;

  const attrIndex = profile.attributes.indexOf(attributeName);
  if (attrIndex < 0) return;

  const ch = fixture.startChannel - 1 + attrIndex;
  if (ch < 512) {
    universe.channels[ch] = Math.max(0, Math.min(255, Math.round(value)));
  }
}

/**
 * Get a named attribute value from a fixture.
 */
export function getFixtureAttribute(
  universe: DMXUniverse,
  fixture: DMXFixture,
  attributeName: string,
): number | null {
  if (!fixture.profileId) return null;
  const profile = DMX_FIXTURE_PROFILES[fixture.profileId];
  if (!profile) return null;

  const attrIndex = profile.attributes.indexOf(attributeName);
  if (attrIndex < 0) return null;

  const ch = fixture.startChannel - 1 + attrIndex;
  return ch < 512 ? universe.channels[ch] : null;
}

/**
 * Interpolate DMX keyframes at a given time.
 * Returns a map of fixtureId → { r, g, b, w }.
 */
export function interpolateKeyframes(
  keyframes: DMXKeyframe[],
  time: number,
): Map<string, { r: number; g: number; b: number; w: number }> {
  const result = new Map<string, { r: number; g: number; b: number; w: number }>();

  // Group by fixture
  const byFixture = new Map<string, DMXKeyframe[]>();
  for (const kf of keyframes) {
    if (!byFixture.has(kf.fixtureId)) byFixture.set(kf.fixtureId, []);
    byFixture.get(kf.fixtureId)!.push(kf);
  }

  for (const [fixtureId, fkfs] of byFixture) {
    const sorted = fkfs.sort((a, b) => a.time - b.time);

    // Find surrounding keyframes
    let before = sorted[0];
    let after = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].time <= time && sorted[i + 1].time >= time) {
        before = sorted[i];
        after = sorted[i + 1];
        break;
      }
    }

    if (time <= before.time) {
      result.set(fixtureId, { r: before.r, g: before.g, b: before.b, w: before.w ?? 0 });
    } else if (time >= after.time) {
      result.set(fixtureId, { r: after.r, g: after.g, b: after.b, w: after.w ?? 0 });
    } else {
      const t = (time - before.time) / (after.time - before.time);
      result.set(fixtureId, {
        r: Math.round(before.r + (after.r - before.r) * t),
        g: Math.round(before.g + (after.g - before.b) * t),
        b: Math.round(before.b + (after.b - before.b) * t),
        w: Math.round((before.w ?? 0) + ((after.w ?? 0) - (before.w ?? 0)) * t),
      });
    }
  }

  return result;
}

/**
 * Convert hex color to DMX channel values.
 */
export function hexToDMX(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

/**
 * Export DMX show as Art-Net compatible CSV.
 * Format: Time,Universe,Channel,Value
 */
export function exportDMXCSV(show: DMXShow): string {
  const lines = ['Time(s),Universe,Channel,R,G,B,W,FixtureLabel'];

  for (const kf of show.keyframes.sort((a, b) => a.time - b.time)) {
    // Find fixture
    for (const u of show.universes) {
      const fixture = u.fixtures.find(f => f.id === kf.fixtureId);
      if (fixture) {
        lines.push(
          `${kf.time.toFixed(3)},${u.id},${fixture.startChannel},${kf.r},${kf.g},${kf.b},${kf.w ?? 0},${fixture.label}`
        );
        break;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Patch GMA2 fixtures into DMX universes preserving their original universe/address.
 * Groups fixtures by universe and creates DMXUniverse objects with proper channel mapping.
 */
export function patchGMA2Fixtures(
  fixtures: Array<{
    fixtureId: number;
    name: string;
    universe: number;
    dmxAddress: number;
    channelCount: number;
    dmxProfileId: string;
  }>,
): DMXUniverse[] {
  // Group by universe
  const byUniverse = new Map<number, typeof fixtures>();
  for (const f of fixtures) {
    if (!byUniverse.has(f.universe)) byUniverse.set(f.universe, []);
    byUniverse.get(f.universe)!.push(f);
  }

  const universes: DMXUniverse[] = [];

  for (const [uniId, uniFixtures] of byUniverse) {
    const sorted = uniFixtures.sort((a, b) => a.dmxAddress - b.dmxAddress);
    const dmxFixtures: DMXFixture[] = sorted.map((f, idx) => {
      const profile = DMX_FIXTURE_PROFILES[f.dmxProfileId];
      const chCount = profile?.channelCount ?? f.channelCount;
      return {
        id: `gma-u${uniId}-${f.dmxAddress}`,
        label: f.name,
        universe: uniId,
        startChannel: f.dmxAddress,
        channelCount: chCount,
        droneIndex: idx,
        profileId: f.dmxProfileId,
      };
    });

    universes.push({
      id: uniId,
      label: `Universe ${uniId}`,
      channels: new Uint8Array(512),
      fixtures: dmxFixtures,
    });
  }

  return universes.sort((a, b) => a.id - b.id);
}
