/**
 * UE5 DMX Library / DMXPrevis Fixture Import Parser
 * 
 * Supports:
 * - CSV export from UE5 Fixture List (columns: Name, FixtureType, Universe, Channel, Mode, GDTF)
 * - JSON export from DMX Library (fixture patches array)
 * 
 * Maps UE5 fixture types to internal DMX profiles and position types.
 */

import { DMX_FIXTURE_PROFILES, type DMXFixture, type DMXUniverse } from './dmxEngine';

export interface UE5DMXFixture {
  name: string;
  fixtureType: string;
  universe: number;
  startChannel: number;
  channelCount: number;
  mode: string;
  gdtfSource: string;
  // Inferred
  profileId: string;
  category: string;
  color: string;
}

export interface UE5DMXParseResult {
  fixtures: UE5DMXFixture[];
  libraryName: string;
  errors: string[];
}

// ── UE5 fixture type keyword → internal profile mapping ──
const UE5_PROFILE_MAP: Record<string, { profileId: string; category: string; color: string }> = {
  'spot':           { profileId: 'moving-head-spot',   category: 'spot',      color: '#FFFFFF' },
  'wash':           { profileId: 'moving-head-wash',   category: 'wash',      color: '#4FC3F7' },
  'beam':           { profileId: 'moving-head-beam',   category: 'beam',      color: '#E0E0E0' },
  'profile':        { profileId: 'framing-spot',       category: 'spot',      color: '#FFF9C4' },
  'moving head':    { profileId: 'moving-head-spot',   category: 'spot',      color: '#FFFFFF' },
  'movinghead':     { profileId: 'moving-head-spot',   category: 'spot',      color: '#FFFFFF' },
  'led bar':        { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'ledbar':         { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'strip':          { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'par':            { profileId: 'generic-rgbw',       category: 'wash',      color: '#FF7043' },
  'led':            { profileId: 'led-wash-rgbwa-uv',  category: 'wash',      color: '#7E57C2' },
  'rgbw':           { profileId: 'generic-rgbw',       category: 'wash',      color: '#FF7043' },
  'rgb':            { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'strobe':         { profileId: 'generic-rgb',        category: 'strobe',    color: '#FFEE58' },
  'blinder':        { profileId: 'generic-rgbw',       category: 'strobe',    color: '#FFF176' },
  'flame':          { profileId: 'sfx-flame',          category: 'sfx',       color: '#FF6D00' },
  'cryo':           { profileId: 'sfx-cryo',           category: 'sfx',       color: '#B3E5FC' },
  'haze':           { profileId: 'generic-rgb',        category: 'sfx',       color: '#90A4AE' },
  'fog':            { profileId: 'generic-rgb',        category: 'sfx',       color: '#78909C' },
  'smoke':          { profileId: 'generic-rgb',        category: 'sfx',       color: '#78909C' },
  'laser':          { profileId: 'generic-rgb',        category: 'laser',     color: '#76FF03' },
  'drone':          { profileId: 'drone-led',          category: 'drone',     color: '#00BCD4' },
};

function inferUE5Profile(fixtureType: string, name: string, mode: string): { profileId: string; category: string; color: string } {
  const combined = `${fixtureType} ${name} ${mode}`.toLowerCase();
  for (const [key, val] of Object.entries(UE5_PROFILE_MAP)) {
    if (combined.includes(key)) return val;
  }
  return { profileId: 'generic-rgbw', category: 'wash', color: '#B0BEC5' };
}

// ═══ CSV Parser ═══

export function parseUE5DMXCsv(csvText: string): UE5DMXParseResult {
  const lines = csvText.trim().split('\n');
  const errors: string[] = [];
  const fixtures: UE5DMXFixture[] = [];

  if (lines.length < 2) {
    return { fixtures: [], libraryName: 'UE5 DMX Import', errors: ['CSV has less than 2 lines'] };
  }

  const header = lines[0].toLowerCase().replace(/"/g, '').split(/[,;\t]/).map(h => h.trim());

  const col = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const nameIdx = col(['name', 'fixture name', 'patch name', 'label']);
  const typeIdx = col(['fixture type', 'fixturetype', 'type']);
  const uniIdx = col(['universe', 'uni']);
  const chIdx = col(['channel', 'start channel', 'address', 'startchannel']);
  const patchIdx = col(['universe.channel', 'patch', 'uni.ch']);
  const modeIdx = col(['mode', 'dmx mode']);
  const chCountIdx = col(['channels', 'channel count', 'num channels', 'channelcount']);
  const gdtfIdx = col(['gdtf', 'dmximport', 'dmx import', 'gdtf source']);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/"/g, '').split(/[,;\t]/).map(c => c.trim());
    if (cols.length < 2 || !cols.some(c => c.length > 0)) continue;

    try {
      const name = nameIdx >= 0 ? cols[nameIdx] : `Fixture ${i}`;
      const fixtureType = typeIdx >= 0 ? cols[typeIdx] : '';
      const mode = modeIdx >= 0 ? cols[modeIdx] : 'Standard';
      const gdtfSource = gdtfIdx >= 0 ? cols[gdtfIdx] : '';

      let universe = 1;
      let startChannel = 1;

      // UE5 uses "Universe.Channel" format (e.g. "2.1")
      if (patchIdx >= 0 && cols[patchIdx]?.includes('.')) {
        const [u, c] = cols[patchIdx].split('.');
        universe = parseInt(u) || 1;
        startChannel = parseInt(c) || 1;
      } else {
        universe = uniIdx >= 0 ? parseInt(cols[uniIdx]) || 1 : 1;
        startChannel = chIdx >= 0 ? parseInt(cols[chIdx]) || 1 : 1;
      }

      const channelCount = chCountIdx >= 0 ? parseInt(cols[chCountIdx]) || 4 : 0;
      const profile = inferUE5Profile(fixtureType, name, mode);

      // If no channel count column, use profile default
      const resolvedChannelCount = channelCount > 0
        ? channelCount
        : (DMX_FIXTURE_PROFILES[profile.profileId]?.channelCount ?? 4);

      fixtures.push({
        name, fixtureType, universe, startChannel,
        channelCount: resolvedChannelCount,
        mode, gdtfSource,
        profileId: profile.profileId,
        category: profile.category,
        color: profile.color,
      });
    } catch (e) {
      errors.push(`Row ${i}: ${(e as Error).message}`);
    }
  }

  return { fixtures, libraryName: 'UE5 DMX CSV Import', errors };
}

// ═══ JSON Parser ═══

export function parseUE5DMXJson(jsonText: string): UE5DMXParseResult {
  const errors: string[] = [];
  const fixtures: UE5DMXFixture[] = [];

  try {
    const data = JSON.parse(jsonText);

    // Support multiple JSON structures from UE5
    const libraryName = data.LibraryName || data.Name || data.name || 'UE5 DMX Library';
    const patchList: any[] = data.FixturePatches || data.Patches || data.fixtures || data.FixtureList || (Array.isArray(data) ? data : []);

    if (patchList.length === 0) {
      errors.push('No fixture patches found in JSON. Expected "FixturePatches", "Patches", or root array.');
      return { fixtures, libraryName, errors };
    }

    for (let i = 0; i < patchList.length; i++) {
      const p = patchList[i];
      try {
        const name = p.Name || p.name || p.FixtureName || `Fixture ${i + 1}`;
        const fixtureType = p.FixtureType || p.fixtureType || p.Type || p.type || '';
        const mode = p.Mode || p.mode || p.ActiveMode || 'Standard';
        const gdtfSource = p.DMXImport || p.GDTF || p.gdtf || '';

        let universe = 1;
        let startChannel = 1;

        // UE5 JSON: UniverseID + StartingChannel or "Universe.Channel" string
        if (p.UniverseID !== undefined) {
          universe = parseInt(p.UniverseID) || 1;
          startChannel = parseInt(p.StartingChannel || p.Channel) || 1;
        } else if (p.Universe !== undefined) {
          universe = parseInt(p.Universe) || 1;
          startChannel = parseInt(p.Channel || p.StartChannel || p.Address) || 1;
        } else if (typeof p.Patch === 'string' && p.Patch.includes('.')) {
          const [u, c] = p.Patch.split('.');
          universe = parseInt(u) || 1;
          startChannel = parseInt(c) || 1;
        }

        const channelCount = parseInt(p.ChannelCount || p.NumChannels || p.Channels) || 0;
        const profile = inferUE5Profile(fixtureType, name, mode);
        const resolvedChannelCount = channelCount > 0
          ? channelCount
          : (DMX_FIXTURE_PROFILES[profile.profileId]?.channelCount ?? 4);

        fixtures.push({
          name, fixtureType, universe, startChannel,
          channelCount: resolvedChannelCount,
          mode, gdtfSource,
          profileId: profile.profileId,
          category: profile.category,
          color: profile.color,
        });
      } catch (e) {
        errors.push(`Fixture ${i}: ${(e as Error).message}`);
      }
    }

    return { fixtures, libraryName, errors };
  } catch (e) {
    return { fixtures: [], libraryName: 'UE5 DMX Import', errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
}

/** Auto-detect format and parse */
export function parseUE5DMXLibrary(text: string): UE5DMXParseResult {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseUE5DMXJson(trimmed);
  }
  return parseUE5DMXCsv(trimmed);
}

/**
 * Convert parsed UE5 fixtures into DMXUniverse objects for the DMX Engine.
 */
export function patchUE5FixturesToUniverses(fixtures: UE5DMXFixture[]): DMXUniverse[] {
  const byUniverse = new Map<number, UE5DMXFixture[]>();
  for (const f of fixtures) {
    if (!byUniverse.has(f.universe)) byUniverse.set(f.universe, []);
    byUniverse.get(f.universe)!.push(f);
  }

  const universes: DMXUniverse[] = [];

  for (const [uniId, uniFixtures] of byUniverse) {
    const sorted = uniFixtures.sort((a, b) => a.startChannel - b.startChannel);
    const dmxFixtures: DMXFixture[] = sorted.map((f, idx) => ({
      id: `ue5-u${uniId}-ch${f.startChannel}`,
      label: f.name,
      universe: uniId,
      startChannel: f.startChannel,
      channelCount: f.channelCount,
      droneIndex: idx,
      profileId: f.profileId,
    }));

    universes.push({
      id: uniId,
      label: `Universe ${uniId}`,
      channels: new Uint8Array(512),
      fixtures: dmxFixtures,
    });
  }

  return universes.sort((a, b) => a.id - b.id);
}
