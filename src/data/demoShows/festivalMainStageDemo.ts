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

  return densifyPyroCues(out, mines, FESTIVAL_DEMO_DURATION_S);
}

// Scene-themed densifier mirror of worldShowPresets:
// - 20s scenes with rotating effect palette
// - Max gap 1s between consecutive cues (fills with palette effects)
const FESTIVAL_SCENE_S = 20;
const FESTIVAL_MAX_GAP_S = 1.0;
const FESTIVAL_PALETTES = [
  { opener: 'mine_8s_gold',   accent: 'mine_4s_gold',   filler: ['mine_2s_silver', 'mine_2s_gold',   'co2_blast_2s',  'mine_2s_red'] },
  { opener: 'mine_8s_silver', accent: 'mine_4s_silver', filler: ['mine_2s_gold',   'mine_2s_silver', 'mine_2s_blue',  'co2_blast_2s'] },
  { opener: 'mine_8s_gold',   accent: 'mine_4s_red',    filler: ['mine_2s_red',    'mine_2s_silver', 'mine_2s_gold',  'co2_blast_2s'] },
  { opener: 'mine_8s_silver', accent: 'mine_4s_blue',   filler: ['mine_2s_blue',   'mine_2s_gold',   'co2_blast_2s',  'mine_2s_silver'] },
  { opener: 'mine_8s_gold',   accent: 'mine_4s_green',  filler: ['mine_2s_green',  'mine_2s_gold',   'mine_2s_silver','co2_blast_2s'] },
  { opener: 'mine_8s_silver', accent: 'mine_4s_purple', filler: ['mine_2s_purple', 'mine_2s_silver', 'co2_blast_2s',  'mine_2s_red'] },
];

// Interlock scene index with global counter for freshness across scenes.
function pickFestivalFiller(palette: typeof FESTIVAL_PALETTES[number], sceneIdx: number, count: number) {
  return palette.filler[(count + sceneIdx * 2 + 1) % palette.filler.length];
}

function densifyPyroCues(
  cues: PyroCue[],
  anchors: StageAnchor[],
  durationS: number,
  maxInserted = 600,
): PyroCue[] {
  if (anchors.length === 0) return cues;
  const out = [...cues].sort((a, b) => a.time - b.time);
  const inserted: PyroCue[] = [];
  let posCursor = 0;
  const nextAnchor = () => anchors[(posCursor++) % anchors.length];

  const makeCue = (effectId: string, time: number, tag: string): PyroCue => {
    const a = nextAnchor();
    const idx = anchors.indexOf(a);
    return {
      id: `pyro-fill-${tag}-${time.toFixed(2)}`,
      time,
      positionId: a.id,
      module: Math.floor(idx / 8),
      channel: idx % 16,
      effectId,
      fuseDelay: 0,
      caliber: 50,
      elevation: 90,
      heading: 0,
      position: { x: a.position[0], y: a.position[1], z: a.position[2] },
      notes: 'demo:scene-fill',
    };
  };

  // Scene openers (where sparse)
  const sceneCount = Math.ceil(durationS / FESTIVAL_SCENE_S);
  for (let s = 0; s < sceneCount && inserted.length < maxInserted; s++) {
    const start = s * FESTIVAL_SCENE_S;
    const end = Math.min(start + FESTIVAL_SCENE_S, durationS);
    const palette = FESTIVAL_PALETTES[s % FESTIVAL_PALETTES.length];
    const inScene = out.filter(c => c.time >= start && c.time < end);
    if (inScene.length < 2) {
      inserted.push(makeCue(palette.opener, start + 0.05, `op${s}`));
      inserted.push(makeCue(palette.accent, start + FESTIVAL_SCENE_S * 0.5, `ac${s}`));
    }
  }
  out.push(...inserted);
  out.sort((a, b) => a.time - b.time);

  // Gap fill
  let fillerCount = 0;
  const gapFilled: PyroCue[] = [];
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].time - out[i].time;
    if (gap <= FESTIVAL_MAX_GAP_S) continue;
    const n = Math.ceil(gap / FESTIVAL_MAX_GAP_S) - 1;
    const step = gap / (n + 1);
    for (let k = 1; k <= n && inserted.length + fillerCount < maxInserted; k++) {
      const t = out[i].time + step * k;
      const palette = FESTIVAL_PALETTES[Math.floor(t / FESTIVAL_SCENE_S) % FESTIVAL_PALETTES.length];
      const eff = palette.filler[fillerCount % palette.filler.length];
      gapFilled.push(makeCue(eff, t, `gf${fillerCount}`));
      fillerCount++;
    }
  }
  out.push(...gapFilled);
  out.sort((a, b) => a.time - b.time);
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
