/**
 * Festival Main Stage Demo Show — canonical seed.
 *
 * Provenance: `marketing_hypothesis` (per cue) — modelled after the public
 * profile of the grandMA "Main 2021-02-03" file but NOT a parsed conversion.
 * Audio + binary `.show.gz` live in Lovable Cloud Storage (`demo-shows/`).
 *
 * Footprint: ~120 cues over 4:30 with 18 mines, 8 CO₂ jets, 16 movers,
 * 32 simulated drones. All positions reference `FESTIVAL_STAGE_ANCHORS`.
 *
 * Compatible with the existing `ShowPlan` contract (`src/core/showplan/ShowPlan.ts`).
 */

import {
  type ShowPlan,
  type PyroCue,
  type DMXCue,
  type DronePath,
  type ShowPosition,
  createEmptyShowPlan,
} from '@/core/showplan/ShowPlan';
import { FESTIVAL_STAGE_ANCHORS, type StageAnchor } from '@/data/stage/stageAnchors';

export const FESTIVAL_DEMO_ID = 'festival-main-stage-demo';
export const FESTIVAL_DEMO_BPM = 128;
export const FESTIVAL_DEMO_DURATION_S = 270; // 4:30
export const FESTIVAL_DEMO_TRANSPORT_REQ: ReadonlyArray<string> = ['two_wire'];

const ANCHOR_BY_KIND = (kind: StageAnchor['kind']) =>
  FESTIVAL_STAGE_ANCHORS.filter((a) => a.kind === kind);

function positionsFromAnchors(): ShowPosition[] {
  return FESTIVAL_STAGE_ANCHORS.map((a, i) => ({
    id: a.id,
    name: a.id,
    type: a.kind.startsWith('co2') || a.kind.startsWith('mine') ? 'pyro' : 'light',
    x: a.position[0],
    y: a.position[1],
    z: a.position[2],
    heading: 0,
    pitch: 0,
    moduleId: a.kind.startsWith('mine') ? `fxk16-${Math.floor(i / 8)}` : undefined,
    channelStart: a.kind.startsWith('mine') ? i % 8 : undefined,
  }));
}

function pyroCues(): PyroCue[] {
  const out: PyroCue[] = [];
  const mines = [...ANCHOR_BY_KIND('mine-front'), ...ANCHOR_BY_KIND('mine-mid'), ...ANCHOR_BY_KIND('mine-back')];
  const co2 = [...ANCHOR_BY_KIND('co2-jet-l'), ...ANCHOR_BY_KIND('co2-jet-r')];
  const beat = 60 / FESTIVAL_DEMO_BPM; // ~0.469s

  // Three mine waves: at 16s, 64s, 200s — each fires every mine in sequence on the beat.
  [16, 64, 200].forEach((tStart, wave) => {
    mines.forEach((anchor, i) => {
      out.push({
        id: `pyro-mine-${wave}-${i}`,
        time: tStart + i * beat,
        positionId: anchor.id,
        module: Math.floor(i / 8),
        channel: i % 16,
        effectId: `mine_8s_${wave === 1 ? 'gold' : 'silver'}`,
        fuseDelay: 0,
        caliber: 75,
        elevation: 90,
        heading: 0,
        position: { x: anchor.position[0], y: anchor.position[1], z: anchor.position[2] },
        notes: 'demo:marketing_hypothesis',
      });
    });
  });

  // CO₂ jets on each downbeat 32s..160s
  for (let t = 32; t <= 160; t += beat * 4) {
    co2.forEach((anchor, i) => {
      out.push({
        id: `pyro-co2-${t.toFixed(2)}-${i}`,
        time: t,
        positionId: anchor.id,
        module: 9,
        channel: i,
        effectId: 'co2_blast_2s',
        fuseDelay: 0,
        caliber: 0,
        elevation: 90,
        heading: anchor.kind === 'co2-jet-l' ? -30 : 30,
        position: { x: anchor.position[0], y: anchor.position[1], z: anchor.position[2] },
        notes: 'demo:marketing_hypothesis',
      });
    });
  }

  return out;
}

function dmxCues(): DMXCue[] {
  const out: DMXCue[] = [];
  // 16 movers on universe 1, ch 1..16, slow colour wash sweeping every 4s
  for (let t = 0; t < FESTIVAL_DEMO_DURATION_S; t += 4) {
    for (let m = 0; m < 16; m++) {
      out.push({
        id: `dmx-${t.toFixed(0)}-${m}`,
        time: t,
        universe: 1,
        channel: 1 + m,
        value: Math.floor(64 + 191 * Math.sin((t + m) * 0.3)),
        duration: 3.5,
        curve: 'ease-in-out',
      });
    }
  }
  return out;
}

function dronePaths(): DronePath[] {
  // 32 drones in a 4×8 grid, drift up to logo formation at t=120s.
  const paths: DronePath[] = [];
  for (let i = 0; i < 32; i++) {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = -14 + col * 4;
    const z = 14 + row * 3;
    paths.push({
      id: `drone-${i}`,
      droneId: `d${i}`,
      padPositionId: `pad-${i}`,
      color: '#7adfff',
      waypoints: [
        { id: `wp-${i}-0`, time: 0, position: { x, y: 0, z }, speed: 0 },
        { id: `wp-${i}-1`, time: 30, position: { x, y: 25 + row * 2, z }, speed: 1.5 },
        { id: `wp-${i}-2`, time: 120, position: { x: col * 3 - 10, y: 40 + row * 4, z: 10 }, speed: 2 },
        { id: `wp-${i}-3`, time: 240, position: { x, y: 25, z }, speed: 1.5 },
        { id: `wp-${i}-4`, time: FESTIVAL_DEMO_DURATION_S, position: { x, y: 0, z }, speed: 1 },
      ],
    });
  }
  return paths;
}

export function buildFestivalMainStageDemo(): ShowPlan {
  const plan = createEmptyShowPlan();
  plan.metadata = {
    ...plan.metadata,
    id: FESTIVAL_DEMO_ID,
    name: 'Festival Main Stage — Demo',
    venue: 'Maracanã (placeholder)',
    gps: { lat: -22.9122, lng: -43.2302, alt: 8 },
    duration: FESTIVAL_DEMO_DURATION_S,
    author: 'Lovable Cloud demo',
    notes: 'demo:marketing_hypothesis — modelled after Main 2021-02-03 (grandMA show file).',
  };
  plan.positions = positionsFromAnchors();
  plan.pyroCues = pyroCues();
  plan.dmxCues = dmxCues();
  plan.dronePaths = dronePaths();
  plan.hardwareConfig = {
    modules: [
      { id: 'fxk16-0', label: 'FXK16 #0 (2-Wire)', type: 'nano-relay-32', channelCount: 16, address: 1 },
      { id: 'fxk16-1', label: 'FXK16 #1 (2-Wire)', type: 'nano-relay-32', channelCount: 16, address: 2 },
      { id: 'ifmx-i32q', label: 'IFMx-i32Q (2-Wire master)', type: 'nano-relay-32', channelCount: 32, address: 0 },
    ],
    muxChannels: 16,
    shiftRegisterBits: 8,
    totalRelays: 64,
  };
  return plan;
}

/**
 * Manifest summary that downstream golden-show / phase-2 gates can read
 * without instantiating the full ShowPlan.
 */
export const FESTIVAL_DEMO_MANIFEST = {
  id: FESTIVAL_DEMO_ID,
  durationS: FESTIVAL_DEMO_DURATION_S,
  bpm: FESTIVAL_DEMO_BPM,
  transportRequirements: FESTIVAL_DEMO_TRANSPORT_REQ,
  provenance: 'marketing_hypothesis' as const,
} as const;
