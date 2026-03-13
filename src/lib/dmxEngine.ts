/**
 * DMX512 / Art-Net Virtual Engine
 * Manages fixture patches, universes, and RGB channel mapping for drone LED control.
 *
 * DMX Universe: 512 channels
 * Each drone fixture: 4 channels (R, G, B, W) or 3 channels (R, G, B)
 * Art-Net supports 32,768 universes
 */

export interface DMXFixture {
  id: string;
  label: string;
  universe: number;
  startChannel: number;  // 1-512
  channelCount: number;  // 3 (RGB) or 4 (RGBW)
  droneIndex: number;    // maps to drone in formation
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
        g: Math.round(before.g + (after.g - before.g) * t),
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
