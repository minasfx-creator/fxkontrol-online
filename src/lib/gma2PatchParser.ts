/**
 * GrandMA2/3 Fixture Patch Parser
 * Parses XML and CSV exports from MA Lighting consoles.
 *
 * Supported formats:
 * - MA2 XML patch export (File → Export → Patch)
 * - MA3 XML fixture sheet export
 * - Generic CSV with columns: FixtureID, Name, FixtureType, Universe, Address, X, Y, Z
 */

import type { PositionType } from '@/store/useProjectStore';

export interface GMA2Fixture {
  fixtureId: number;
  name: string;
  fixtureType: string;
  manufacturer: string;
  mode: string;
  universe: number;
  dmxAddress: number;
  channelCount: number;
  // 3D position (meters)
  x: number;
  y: number;
  z: number;
  // Orientation
  pan: number;
  tilt: number;
  rotation: number;
  // Inferred mapping
  positionType: PositionType;
  dmxProfileId: string;
  color: string;
}

export interface GMA2PatchResult {
  fixtures: GMA2Fixture[];
  showName: string;
  errors: string[];
}

// ── Fixture type → internal profile mapping ──
const PROFILE_MAP: Record<string, { profileId: string; posType: PositionType; color: string }> = {
  // Moving heads
  'spot':         { profileId: 'moving-head-spot', posType: 'light', color: '#FFFFFF' },
  'wash':         { profileId: 'moving-head-wash', posType: 'light', color: '#4FC3F7' },
  'beam':         { profileId: 'moving-head-beam', posType: 'light', color: '#E0E0E0' },
  'profile':      { profileId: 'framing-spot',     posType: 'light', color: '#FFF9C4' },
  'moving':       { profileId: 'moving-head-spot', posType: 'light', color: '#FFFFFF' },
  'sharpy':       { profileId: 'moving-head-beam', posType: 'light', color: '#E0E0E0' },
  // LED
  'led':          { profileId: 'led-wash-rgbwa-uv', posType: 'light', color: '#7E57C2' },
  'par':          { profileId: 'generic-rgbw',      posType: 'light', color: '#FF7043' },
  'bar':          { profileId: 'generic-rgb',       posType: 'light', color: '#26A69A' },
  'strip':        { profileId: 'generic-rgb',       posType: 'light', color: '#26A69A' },
  // Strobe
  'strobe':       { profileId: 'generic-rgb',       posType: 'light', color: '#FFEE58' },
  'blinder':      { profileId: 'generic-rgbw',      posType: 'light', color: '#FFF176' },
  // SFX
  'flame':        { profileId: 'sfx-flame',         posType: 'pyro',  color: '#FF6D00' },
  'cryo':         { profileId: 'sfx-cryo',          posType: 'pyro',  color: '#B3E5FC' },
  'haze':         { profileId: 'generic-rgb',       posType: 'pyro',  color: '#90A4AE' },
  'fog':          { profileId: 'generic-rgb',       posType: 'pyro',  color: '#78909C' },
  'smoke':        { profileId: 'generic-rgb',       posType: 'pyro',  color: '#78909C' },
  'confetti':     { profileId: 'sfx-flame',         posType: 'pyro',  color: '#EC407A' },
  // Laser
  'laser':        { profileId: 'generic-rgb',       posType: 'light', color: '#76FF03' },
};

function inferProfile(fixtureType: string, name: string): { profileId: string; posType: PositionType; color: string } {
  const combined = `${fixtureType} ${name}`.toLowerCase();
  for (const [key, val] of Object.entries(PROFILE_MAP)) {
    if (combined.includes(key)) return val;
  }
  return { profileId: 'generic-rgbw', posType: 'light', color: '#B0BEC5' };
}

// ═══ XML Parser ═══

export function parseGMA2XML(xmlText: string): GMA2PatchResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const errors: string[] = [];

  // Check parse error
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return { fixtures: [], showName: '', errors: ['Invalid XML: ' + parseError.textContent?.slice(0, 100)] };
  }

  const showName = doc.documentElement.getAttribute('name') || doc.querySelector('Show')?.getAttribute('name') || 'GMA2 Import';
  const fixtures: GMA2Fixture[] = [];

  // MA2 format: <Fixture> elements inside <FixtureLayer> or <Fixtures>
  const fixtureEls = doc.querySelectorAll('Fixture, fixture, SubFixture');
  
  fixtureEls.forEach((el, idx) => {
    try {
      const fixtureId = parseInt(el.getAttribute('fixture_id') || el.getAttribute('FixtureId') || el.getAttribute('id') || String(idx + 1));
      const name = el.getAttribute('name') || el.getAttribute('Name') || `Fixture ${fixtureId}`;
      const fixtureType = el.getAttribute('fixture_type') || el.getAttribute('FixtureType') || el.getAttribute('type') || '';
      const manufacturer = el.getAttribute('manufacturer') || el.getAttribute('Manufacturer') || '';
      const mode = el.getAttribute('mode') || el.getAttribute('Mode') || 'Standard';

      // DMX address: Universe.Address or separate attributes
      let universe = 1;
      let dmxAddress = 1;
      const patch = el.getAttribute('patch') || el.getAttribute('Patch') || el.getAttribute('dmx') || '';
      if (patch.includes('.')) {
        const [u, a] = patch.split('.');
        universe = parseInt(u) || 1;
        dmxAddress = parseInt(a) || 1;
      } else {
        universe = parseInt(el.getAttribute('universe') || el.getAttribute('Universe') || '1');
        dmxAddress = parseInt(el.getAttribute('address') || el.getAttribute('Address') || el.getAttribute('dmx_address') || '1');
      }

      const channelCount = parseInt(el.getAttribute('channel_count') || el.getAttribute('ChannelCount') || el.getAttribute('channels') || '4');

      // 3D position
      const posEl = el.querySelector('Position, position, Pos');
      const x = parseFloat(posEl?.getAttribute('x') || el.getAttribute('x') || el.getAttribute('pos_x') || '0');
      const y = parseFloat(posEl?.getAttribute('y') || el.getAttribute('y') || el.getAttribute('pos_y') || '0');
      const z = parseFloat(posEl?.getAttribute('z') || el.getAttribute('z') || el.getAttribute('pos_z') || '0');

      const pan = parseFloat(posEl?.getAttribute('pan') || el.getAttribute('pan') || '0');
      const tilt = parseFloat(posEl?.getAttribute('tilt') || el.getAttribute('tilt') || '0');
      const rotation = parseFloat(posEl?.getAttribute('rotation') || el.getAttribute('rotation') || '0');

      const profile = inferProfile(fixtureType, name);

      fixtures.push({
        fixtureId, name, fixtureType, manufacturer, mode,
        universe, dmxAddress, channelCount,
        x, y, z, pan, tilt, rotation,
        positionType: profile.posType,
        dmxProfileId: profile.profileId,
        color: profile.color,
      });
    } catch (e) {
      errors.push(`Error parsing fixture ${idx}: ${(e as Error).message}`);
    }
  });

  if (fixtures.length === 0) {
    errors.push('No fixtures found. Expected <Fixture> elements in XML.');
  }

  return { fixtures, showName, errors };
}

// ═══ CSV Parser ═══

export function parseGMA2CSV(csvText: string): GMA2PatchResult {
  const lines = csvText.trim().split('\n');
  const errors: string[] = [];
  const fixtures: GMA2Fixture[] = [];

  if (lines.length < 2) {
    return { fixtures: [], showName: 'CSV Import', errors: ['CSV has less than 2 lines'] };
  }

  const header = lines[0].toLowerCase().replace(/"/g, '').split(/[,;\t]/).map(h => h.trim());

  // Column mapping with common MA variations
  const col = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const idIdx = col(['fixtureid', 'fixture_id', 'id', 'fix id', 'fid']);
  const nameIdx = col(['name', 'nome', 'label', 'fixture name']);
  const typeIdx = col(['type', 'fixture type', 'fixturetype', 'tipo']);
  const mfgIdx = col(['manufacturer', 'fabricante', 'mfg']);
  const modeIdx = col(['mode', 'modo']);
  const uniIdx = col(['universe', 'uni', 'universo']);
  const addrIdx = col(['address', 'addr', 'dmx', 'dmx address', 'channel', 'endereço']);
  const chCountIdx = col(['channels', 'channel count', 'ch count', 'canais']);
  const xIdx = col(['x', 'pos x', 'posx']);
  const yIdx = col(['y', 'pos y', 'posy', 'height', 'alt']);
  const zIdx = col(['z', 'pos z', 'posz']);
  const patchIdx = col(['patch']);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/"/g, '').split(/[,;\t]/).map(c => c.trim());
    if (cols.length < 2 || !cols.some(c => c.length > 0)) continue;

    try {
      const fixtureId = idIdx >= 0 ? parseInt(cols[idIdx]) || i : i;
      const name = nameIdx >= 0 ? cols[nameIdx] : `Fixture ${i}`;
      const fixtureType = typeIdx >= 0 ? cols[typeIdx] : '';
      const manufacturer = mfgIdx >= 0 ? cols[mfgIdx] : '';
      const mode = modeIdx >= 0 ? cols[modeIdx] : 'Standard';

      let universe = 1;
      let dmxAddress = 1;
      if (patchIdx >= 0 && cols[patchIdx]?.includes('.')) {
        const [u, a] = cols[patchIdx].split('.');
        universe = parseInt(u) || 1;
        dmxAddress = parseInt(a) || 1;
      } else {
        universe = uniIdx >= 0 ? parseInt(cols[uniIdx]) || 1 : 1;
        dmxAddress = addrIdx >= 0 ? parseInt(cols[addrIdx]) || 1 : 1;
      }

      const channelCount = chCountIdx >= 0 ? parseInt(cols[chCountIdx]) || 4 : 4;
      const x = xIdx >= 0 ? parseFloat(cols[xIdx]) || 0 : 0;
      const y = yIdx >= 0 ? parseFloat(cols[yIdx]) || 0 : 0;
      const z = zIdx >= 0 ? parseFloat(cols[zIdx]) || 0 : 0;

      const profile = inferProfile(fixtureType, name);

      fixtures.push({
        fixtureId, name, fixtureType, manufacturer, mode,
        universe, dmxAddress, channelCount,
        x, y, z, pan: 0, tilt: 0, rotation: 0,
        positionType: profile.posType,
        dmxProfileId: profile.profileId,
        color: profile.color,
      });
    } catch (e) {
      errors.push(`Row ${i}: ${(e as Error).message}`);
    }
  }

  return { fixtures, showName: 'CSV Import', errors };
}

/** Auto-detect format and parse */
export function parseGMA2Patch(text: string): GMA2PatchResult {
  const trimmed = text.trim();
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return parseGMA2XML(trimmed);
  }
  return parseGMA2CSV(trimmed);
}
