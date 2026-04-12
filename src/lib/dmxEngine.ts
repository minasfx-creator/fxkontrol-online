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
 * Set fixture color in the universe channel buffer.
 */
export function setFixtureColor(
  universe: DMXUniverse,
  fixture: DMXFixture,
  r: number, g: number, b: number, w = 0,
): void {
  const ch = fixture.startChannel - 1;
  universe.channels[ch] = Math.max(0, Math.min(255, Math.round(r)));
  universe.channels[ch + 1] = Math.max(0, Math.min(255, Math.round(g)));
  universe.channels[ch + 2] = Math.max(0, Math.min(255, Math.round(b)));
  if (fixture.channelCount >= 4) {
    universe.channels[ch + 3] = Math.max(0, Math.min(255, Math.round(w)));
  }
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
