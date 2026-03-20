/**
 * MVR (My Virtual Rig) Parser
 * 
 * MVR is a ZIP archive containing:
 * - GeneralSceneDescription.xml — fixture list with 3D positions, DMX addresses, GDTF refs
 * - *.gdtf files — fixture profiles (also ZIPs containing description.xml with DMX channel info)
 * 
 * This parser extracts fixtures with full 3D coordinates and DMX patch data,
 * mapping them to internal DMX profiles for the editor viewport and DMX engine.
 */

import JSZip from 'jszip';
import { DMX_FIXTURE_PROFILES, type DMXFixture, type DMXUniverse } from './dmxEngine';

export interface MVRFixture {
  name: string;
  uuid: string;
  gdtfSpec: string;
  gdtfMode: string;
  fixtureId: string;
  universe: number;
  startChannel: number;
  channelCount: number;
  // 3D position (UE5 units → meters: divide by 100)
  x: number;
  y: number;
  z: number;
  // Inferred
  profileId: string;
  category: string;
  color: string;
  fixtureType: string;
}

export interface GDTFModeInfo {
  name: string;
  channelCount: number;
}

export interface GDTFProfile {
  name: string;
  modes: GDTFModeInfo[];
}

export interface MVRParseResult {
  fixtures: MVRFixture[];
  gdtfProfiles: Map<string, GDTFProfile>;
  libraryName: string;
  errors: string[];
  stats: {
    totalFixtures: number;
    fixtureTypes: Record<string, number>;
    universes: number;
  };
}

// ── GDTF Spec keyword → internal profile mapping ──
const GDTF_PROFILE_MAP: Record<string, { profileId: string; category: string; color: string; type: string }> = {
  'spot':           { profileId: 'moving-head-spot',   category: 'spot',      color: '#FFFFFF', type: 'Spot' },
  'spotmh':         { profileId: 'moving-head-spot',   category: 'spot',      color: '#FFFFFF', type: 'Spot MH' },
  'washmh':         { profileId: 'moving-head-wash',   category: 'wash',      color: '#4FC3F7', type: 'Wash MH' },
  'washsl':         { profileId: 'led-wash-rgbwa-uv',  category: 'wash',      color: '#7E57C2', type: 'Wash SL' },
  'beam':           { profileId: 'moving-head-beam',   category: 'beam',      color: '#E0E0E0', type: 'Beam' },
  'strobrgb':       { profileId: 'generic-rgb',        category: 'strobe',    color: '#FFEE58', type: 'Strobe RGB' },
  'strobe':         { profileId: 'generic-rgb',        category: 'strobe',    color: '#FFEE58', type: 'Strobe' },
  'audience':       { profileId: 'generic-rgbw',       category: 'wash',      color: '#FF7043', type: 'Audience' },
  'audiencestrip':  { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A', type: 'Audience Strip' },
  'catwalkstrip':   { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A', type: 'Catwalk Strip' },
  'matrixstrip':    { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A', type: 'Matrix Strip' },
  'matrixstriprgb': { profileId: 'generic-rgb',        category: 'led-bar',   color: '#00E676', type: 'Matrix Strip RGB' },
  'trusstoner':     { profileId: 'generic-rgbw',       category: 'wash',      color: '#B0BEC5', type: 'Truss Toner' },
  'scenicwash':     { profileId: 'led-wash-rgbwa-uv',  category: 'wash',      color: '#AB47BC', type: 'Scenic Wash' },
  'stadiumlight':   { profileId: 'generic-rgbw',       category: 'wash',      color: '#FFF176', type: 'Stadium Light' },
  'sphere':         { profileId: 'moving-head-spot',   category: 'spot',      color: '#E1BEE7', type: 'Sphere' },
  'pyro':           { profileId: 'sfx-flame',          category: 'sfx',       color: '#FF6D00', type: 'Pyro' },
  'firework':       { profileId: 'sfx-flame',          category: 'sfx',       color: '#FF3D00', type: 'Fireworks' },
  'laser':          { profileId: 'generic-rgb',        category: 'laser',     color: '#76FF03', type: 'Laser' },
  'led':            { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A', type: 'LED' },
  'par':            { profileId: 'generic-rgbw',       category: 'wash',      color: '#FF7043', type: 'PAR' },
};

function inferProfile(gdtfSpec: string, name: string): { profileId: string; category: string; color: string; type: string } {
  // Extract fixture type name from GDTF spec like "EpicGames@UE5_7_Generated_SpotMH1@20_03_26"
  const specLower = gdtfSpec.toLowerCase();
  const nameLower = name.toLowerCase();
  
  // Try to extract the generated type name
  const genMatch = gdtfSpec.match(/Generated_(\w+?)(\d*)@/i);
  const typeName = genMatch ? genMatch[1].toLowerCase() : '';
  
  // Check type name first (most specific)
  if (typeName) {
    for (const [key, val] of Object.entries(GDTF_PROFILE_MAP)) {
      if (typeName.includes(key) || key.includes(typeName)) return val;
    }
  }
  
  // Check full spec and name
  const combined = `${specLower} ${nameLower}`;
  for (const [key, val] of Object.entries(GDTF_PROFILE_MAP)) {
    if (combined.includes(key)) return val;
  }
  
  return { profileId: 'generic-rgbw', category: 'wash', color: '#B0BEC5', type: 'Generic' };
}

// ═══ GDTF Parser (extracts channel count per mode) ═══

async function parseGDTF(gdtfData: ArrayBuffer): Promise<GDTFProfile> {
  const modes: GDTFModeInfo[] = [];
  let name = 'Unknown';
  
  try {
    const zip = await JSZip.loadAsync(gdtfData);
    const descFile = zip.file('description.xml');
    if (!descFile) return { name, modes };
    
    const xmlText = await descFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Get fixture type name
    const ftNode = doc.querySelector('FixtureType');
    name = ftNode?.getAttribute('Name') || ftNode?.getAttribute('LongName') || 'Unknown';
    
    // Parse DMX modes
    const modeNodes = doc.querySelectorAll('DMXMode');
    for (const modeNode of modeNodes) {
      const modeName = modeNode.getAttribute('Name') || 'Default';
      const channels = modeNode.querySelectorAll('DMXChannel');
      modes.push({ name: modeName, channelCount: channels.length });
    }
  } catch (e) {
    console.warn('GDTF parse error:', e);
  }
  
  return { name, modes: modes.length > 0 ? modes : [{ name: 'Default', channelCount: 4 }] };
}

// ═══ MVR XML Parser ═══

function parseMatrix(matrixStr: string): { x: number; y: number; z: number } {
  // MVR matrix format: {r1}{r2}{r3}{translation} — we need the 4th vector
  const vectors = matrixStr.match(/\{([^}]+)\}/g);
  if (!vectors || vectors.length < 4) return { x: 0, y: 0, z: 0 };
  
  const translation = vectors[3].replace(/[{}]/g, '').split(',').map(Number);
  // UE5 units are centimeters, convert to meters
  return {
    x: (translation[0] || 0) / 100,
    y: (translation[1] || 0) / 100,
    z: (translation[2] || 0) / 100,
  };
}

// ═══ Main MVR Parser ═══

export async function parseMVR(arrayBuffer: ArrayBuffer): Promise<MVRParseResult> {
  const errors: string[] = [];
  const fixtures: MVRFixture[] = [];
  const gdtfProfiles = new Map<string, GDTFProfile>();
  
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // 1. Parse GDTF profiles first
    const gdtfFiles = Object.keys(zip.files).filter(f => f.endsWith('.gdtf'));
    for (const gdtfFile of gdtfFiles) {
      try {
        const data = await zip.files[gdtfFile].async('arraybuffer');
        const profile = await parseGDTF(data);
        // Key by spec name (filename without extension)
        const specName = gdtfFile.replace('.gdtf', '');
        gdtfProfiles.set(specName, profile);
      } catch (e) {
        errors.push(`GDTF parse error: ${gdtfFile} — ${(e as Error).message}`);
      }
    }
    
    // 2. Parse GeneralSceneDescription.xml
    const xmlFile = zip.file('GeneralSceneDescription.xml');
    if (!xmlFile) {
      errors.push('No GeneralSceneDescription.xml found in MVR archive');
      return { fixtures, gdtfProfiles, libraryName: 'MVR Import', errors, stats: { totalFixtures: 0, fixtureTypes: {}, universes: 0 } };
    }
    
    const xmlText = await xmlFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Get library metadata
    const userData = doc.querySelector('Data');
    const provider = userData?.getAttribute('provider') || 'Unknown';
    const ver = userData?.getAttribute('ver') || '';
    const libraryName = `${provider} ${ver}`.trim();
    
    // Parse fixtures
    const fixtureNodes = doc.querySelectorAll('Fixture');
    
    for (const node of fixtureNodes) {
      try {
        const name = node.getAttribute('name') || 'Unnamed';
        const uuid = node.getAttribute('uuid') || '';
        const gdtfSpec = node.querySelector('GDTFSpec')?.textContent || '';
        const gdtfMode = node.querySelector('GDTFMode')?.textContent || 'Standard';
        const fixtureId = node.querySelector('FixtureID')?.textContent || '0';
        
        // Parse DMX address
        const addressNode = node.querySelector('Address');
        const address = parseInt(addressNode?.textContent || '1') || 1;
        const breakNum = parseInt(addressNode?.getAttribute('break') || '0') || 0;
        // MVR uses break as universe offset (break 0 = universe 1)
        const universe = breakNum + 1;
        
        // Parse 3D position from matrix
        const matrixStr = node.querySelector('Matrix')?.textContent || '';
        const pos = parseMatrix(matrixStr);
        
        // Get channel count from GDTF profile
        const gdtfProfile = gdtfProfiles.get(gdtfSpec);
        const modeInfo = gdtfProfile?.modes.find(m => 
          m.name.toLowerCase() === gdtfMode.toLowerCase()
        ) || gdtfProfile?.modes[0];
        const channelCount = modeInfo?.channelCount || 4;
        
        // Infer internal profile
        const profile = inferProfile(gdtfSpec, name);
        
        fixtures.push({
          name,
          uuid,
          gdtfSpec,
          gdtfMode,
          fixtureId,
          universe,
          startChannel: address,
          channelCount,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          profileId: profile.profileId,
          category: profile.category,
          color: profile.color,
          fixtureType: profile.type,
        });
      } catch (e) {
        errors.push(`Fixture parse error: ${(e as Error).message}`);
      }
    }
    
    // Build stats
    const fixtureTypes: Record<string, number> = {};
    const universeSet = new Set<number>();
    for (const f of fixtures) {
      fixtureTypes[f.fixtureType] = (fixtureTypes[f.fixtureType] || 0) + 1;
      universeSet.add(f.universe);
    }
    
    return {
      fixtures,
      gdtfProfiles,
      libraryName,
      errors,
      stats: {
        totalFixtures: fixtures.length,
        fixtureTypes,
        universes: universeSet.size,
      },
    };
  } catch (e) {
    return {
      fixtures: [],
      gdtfProfiles,
      libraryName: 'MVR Import',
      errors: [`Failed to parse MVR: ${(e as Error).message}`],
      stats: { totalFixtures: 0, fixtureTypes: {}, universes: 0 },
    };
  }
}

/**
 * Convert parsed MVR fixtures into DMXUniverse objects for the DMX Engine.
 */
export function patchMVRFixturesToUniverses(fixtures: MVRFixture[]): DMXUniverse[] {
  const byUniverse = new Map<number, MVRFixture[]>();
  for (const f of fixtures) {
    if (!byUniverse.has(f.universe)) byUniverse.set(f.universe, []);
    byUniverse.get(f.universe)!.push(f);
  }

  const universes: DMXUniverse[] = [];

  for (const [uniId, uniFixtures] of byUniverse) {
    const sorted = uniFixtures.sort((a, b) => a.startChannel - b.startChannel);
    const dmxFixtures: DMXFixture[] = sorted.map((f, idx) => ({
      id: `mvr-u${uniId}-ch${f.startChannel}`,
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
