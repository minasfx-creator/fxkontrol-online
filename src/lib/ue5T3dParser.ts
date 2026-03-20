/**
 * UE5 T3D / COPY Format Parser for DMX Library fixture patches.
 *
 * Parses the native text format produced by Ctrl+C (Copy) in UE5's
 * DMX Library editor. Extracts fixture types and fixture patches.
 */

import { DMX_FIXTURE_PROFILES } from './dmxEngine';
import type { UE5DMXFixture, UE5DMXParseResult } from './ue5DmxPrevisParser';

// Re-use the profile inference from the main parser
// We inline a local copy to avoid circular deps — same logic
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
  'pyro':           { profileId: 'sfx-flame',          category: 'sfx',       color: '#FF6D00' },
  'audience':       { profileId: 'generic-rgb',        category: 'wash',      color: '#7E57C2' },
  'scenic':         { profileId: 'moving-head-wash',   category: 'wash',      color: '#4FC3F7' },
  'matrix':         { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'catwalk':        { profileId: 'generic-rgb',        category: 'led-bar',   color: '#26A69A' },
  'emissive':       { profileId: 'generic-rgb',        category: 'wash',      color: '#B0BEC5' },
};

function inferProfile(name: string, category: string): { profileId: string; category: string; color: string } {
  const combined = `${name} ${category}`.toLowerCase();
  for (const [key, val] of Object.entries(UE5_PROFILE_MAP)) {
    if (combined.includes(key)) return val;
  }
  return { profileId: 'generic-rgbw', category: 'wash', color: '#B0BEC5' };
}

/** Convert UE5 linear float RGBA to hex CSS color */
function linearColorToHex(r: number, g: number, b: number): string {
  // UE5 stores colors in linear space; convert to sRGB
  const toSRGB = (v: number) => Math.round(Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)) * 255);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(toSRGB(r))}${hex(toSRGB(g))}${hex(toSRGB(b))}`;
}

interface FixtureTypeInfo {
  name: string;
  category: string;
  channelSpan: number;
  modeName: string;
}

/** Detect whether a text blob is UE5 T3D/COPY format */
export function isT3DFormat(text: string): boolean {
  return text.includes('Begin Object') && (
    text.includes('DMXEntityFixturePatch') ||
    text.includes('/Script/DMXRuntime')
  );
}

export function parseUE5T3D(text: string): UE5DMXParseResult {
  const errors: string[] = [];
  const fixtures: UE5DMXFixture[] = [];

  // ── Step 1: Extract fixture type definitions ──
  // These blocks look like:
  //   Begin Object Name="DMXEntityFixtureType_0" ...
  //     DMXCategory=(Name="Moving Head")
  //     Modes(0)=(ModeName="Standard",...,ChannelSpan=13,...)
  //     Name="SpotMH1"
  //   End Object
  const typeMap = new Map<string, FixtureTypeInfo>();

  const typeBlockRegex = /Begin Object Name="(DMXEntityFixtureType_\d+)"[^\n]*\n([\s\S]*?)End Object/g;
  let typeMatch: RegExpExecArray | null;

  while ((typeMatch = typeBlockRegex.exec(text)) !== null) {
    const typeId = typeMatch[1];
    const block = typeMatch[2];

    // Only process detail blocks (ones with Name= property inside)
    const nameMatch = block.match(/^\s+Name="([^"]+)"/m);
    if (!nameMatch) continue;

    const typeName = nameMatch[1];
    const categoryMatch = block.match(/DMXCategory=\(Name="([^"]+)"\)/);
    const category = categoryMatch ? categoryMatch[1] : '';
    const channelSpanMatch = block.match(/ChannelSpan=(\d+)/);
    const channelSpan = channelSpanMatch ? parseInt(channelSpanMatch[1]) : 4;
    const modeNameMatch = block.match(/ModeName="([^"]+)"/);
    const modeName = modeNameMatch ? modeNameMatch[1] : 'Standard';

    typeMap.set(typeId, { name: typeName, category, channelSpan, modeName });
  }

  // ── Step 2: Extract fixture patches ──
  // Detail blocks (after forward declarations) have properties:
  //   Begin Object Name="DMXEntityFixturePatch_734" ...
  //     UniverseID=13          (optional, default 0 → mapped to 1)
  //     StartingChannel=53
  //     ParentFixtureTypeTemplate="...DMXEntityFixtureType_0'"
  //     FixtureID=76
  //     MVRFixtureUUID=...
  //     EditorColor=(R=...,G=...,B=...,A=...)
  //     Name="SpotMH1_205"
  //   End Object
  const patchBlockRegex = /Begin Object Name="(DMXEntityFixturePatch_\d+)"[^\n]*\n([\s\S]*?)End Object/g;
  let patchMatch: RegExpExecArray | null;

  while ((patchMatch = patchBlockRegex.exec(text)) !== null) {
    const block = patchMatch[2];

    // Only process detail blocks (ones with Name= or StartingChannel)
    const nameMatch = block.match(/^\s+Name="([^"]+)"/m);
    if (!nameMatch) continue; // Skip forward-declaration stubs

    const name = nameMatch[1];

    try {
      const universeMatch = block.match(/UniverseID=(\d+)/);
      const universe = universeMatch ? parseInt(universeMatch[1]) + 1 : 1; // UE5 is 0-based

      const channelMatch = block.match(/StartingChannel=(\d+)/);
      const startChannel = channelMatch ? parseInt(channelMatch[1]) : 1;

      const fixtureIdMatch = block.match(/FixtureID=(\d+)/);
      const fixtureId = fixtureIdMatch ? parseInt(fixtureIdMatch[1]) : 0;

      const activeModeMatch = block.match(/ActiveMode=(\d+)/);
      const activeMode = activeModeMatch ? parseInt(activeModeMatch[1]) : 0;

      const mvrUuidMatch = block.match(/MVRFixtureUUID=([A-F0-9]+)/i);
      const mvrUuid = mvrUuidMatch ? mvrUuidMatch[1] : '';

      // Parse EditorColor
      let editorColorHex = '#B0BEC5';
      const colorMatch = block.match(/EditorColor=\(R=([\d.]+),G=([\d.]+),B=([\d.]+)/);
      if (colorMatch) {
        editorColorHex = linearColorToHex(
          parseFloat(colorMatch[1]),
          parseFloat(colorMatch[2]),
          parseFloat(colorMatch[3])
        );
      }

      // Resolve parent fixture type
      const parentTypeMatch = block.match(/ParentFixtureTypeTemplate="[^"]*?(DMXEntityFixtureType_\d+)'/);
      let fixtureType = '';
      let channelCount = 4;
      let modeName = 'Standard';

      if (parentTypeMatch && typeMap.has(parentTypeMatch[1])) {
        const typeInfo = typeMap.get(parentTypeMatch[1])!;
        fixtureType = typeInfo.name;
        channelCount = typeInfo.channelSpan;
        modeName = typeInfo.modeName;
      }

      // Infer profile from name + fixture type
      const profile = inferProfile(name, fixtureType);

      // Use editor color if available, otherwise profile default
      const color = colorMatch ? editorColorHex : profile.color;

      // If no type channel count, fall back to profile default
      const resolvedChannelCount = channelCount > 0
        ? channelCount
        : (DMX_FIXTURE_PROFILES[profile.profileId]?.channelCount ?? 4);

      fixtures.push({
        name,
        fixtureType,
        universe,
        startChannel,
        channelCount: resolvedChannelCount,
        mode: modeName,
        gdtfSource: mvrUuid ? `MVR:${mvrUuid}` : '',
        profileId: profile.profileId,
        category: profile.category,
        color,
      });
    } catch (e) {
      errors.push(`Patch "${name}": ${(e as Error).message}`);
    }
  }

  // Extract library name from root object
  const libNameMatch = text.match(/Begin Object Class=.*?\.DMXLibrary Name="([^"]+)"/);
  const libraryName = libNameMatch ? libNameMatch[1] : 'UE5 T3D Import';

  // Sort by universe then channel for consistent ordering
  fixtures.sort((a, b) => a.universe - b.universe || a.startChannel - b.startChannel);

  return {
    fixtures,
    libraryName: `${libraryName} (T3D)`,
    errors,
  };
}
