/**
 * ─── Show Libertadores · Golden Show Seed (Phase 1) ─────────────────
 *
 * Canonical reference show used to validate the simulation→export
 * pipeline end-to-end. Inspired by a Copa Libertadores final at a
 * 75 000-seat stadium, ~90s of program, three movements:
 *
 *   t=0..30s   · Build-up   — alternating low fountains + slow comets
 *   t=30..60s  · Anthem     — synchronized high shells in arc
 *   t=60..90s  · Finale     — full barrage (highs + lows + cross-comets)
 *
 * Hardware: 4 × FXK16 modules (64 channels total).
 *  - module 0 ch 0..15  → low effects (fountains, gerbs, comets) — south arc
 *  - module 1 ch 0..15  → low effects — north arc
 *  - module 2 ch 0..15  → high shells (75mm, 90°) — south arc
 *  - module 3 ch 0..15  → high shells (75mm, 90°) — north arc
 *
 * Coordinate system (canonical): YZX rotations, position in meters,
 * stage origin at (0, 0, 0), audience south at z = -40m, pyro line
 * along x-axis from -45m to +45m, height (y) = ground.
 *
 * Honesty layer: zero `Math.random()`, deterministic times via formula.
 */

import type {
  ShowPlan,
  PyroCue,
  ShowPosition,
  HardwareModuleConfig,
} from '@/core/showplan/ShowPlan';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';

const SHOW_NAME = 'Libertadores · Final · Golden Show';
const SHOW_VENUE = 'Estádio referencial 75k (Maracanã-style)';
const SHOW_DURATION_S = 90;
const STAGE_HALF_WIDTH_M = 45;
const POINTS_LOW = 32;
const POINTS_HIGH = 32;
const COMETS = 8;

/** 4 × FXK16 (16ch each) — 64 canais totais. */
function buildModules(): HardwareModuleConfig[] {
  const mk = (i: number, label: string): HardwareModuleConfig => ({
    id: `fxk16-${i}`,
    label,
    type: 'fxk16-esp32s3',
    channelCount: 16,
    address: i + 1,
    batteryVoltage: 12,
    protocolFamily: 'showven-c16-compatible',
    firmwareModel: 'FXK16',
    compatibleWith: 'pyroslave_c16',
  });
  return [
    mk(0, 'Low SOUTH (gerbs/fountains/comets)'),
    mk(1, 'Low NORTH (gerbs/fountains/comets)'),
    mk(2, 'High SOUTH (75mm shells)'),
    mk(3, 'High NORTH (75mm shells)'),
  ];
}

/** Distribute N positions evenly along a horizontal arc (z fixed). */
function arcPositions(
  prefix: string,
  type: ShowPosition['type'],
  count: number,
  z: number,
  moduleId: string,
  channelStart: number,
  section: string,
): ShowPosition[] {
  const out: ShowPosition[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = -STAGE_HALF_WIDTH_M + t * (2 * STAGE_HALF_WIDTH_M);
    out.push({
      id: `${prefix}-${i.toString().padStart(2, '0')}`,
      name: `${prefix.toUpperCase()} #${i + 1}`,
      type,
      x,
      y: 0,
      z,
      heading: 0,
      pitch: type === 'pyro' ? (z < 0 ? 90 : 90) : 0,
      section,
      moduleId,
      channelStart: channelStart + i,
    });
  }
  return out;
}

function buildPositions(): ShowPosition[] {
  // 16 low south + 16 low north + 16 high south + 16 high north = 64
  return [
    ...arcPositions('low-s', 'pyro', 16, -30, 'fxk16-0', 0, 'low-south'),
    ...arcPositions('low-n', 'pyro', 16, +30, 'fxk16-1', 0, 'low-north'),
    ...arcPositions('high-s', 'pyro', 16, -25, 'fxk16-2', 0, 'high-south'),
    ...arcPositions('high-n', 'pyro', 16, +25, 'fxk16-3', 0, 'high-north'),
  ];
}

function cue(args: {
  id: string;
  time: number;
  pos: ShowPosition;
  module: number;
  channel: number;
  effectId: string;
  caliber: number;
  elevation: number;
  fuseDelay?: number;
  section?: string;
}): PyroCue {
  return {
    id: args.id,
    time: Math.round(args.time * 1000) / 1000,
    positionId: args.pos.id,
    module: args.module,
    channel: args.channel,
    effectId: args.effectId,
    fuseDelay: args.fuseDelay ?? 0,
    caliber: args.caliber,
    elevation: args.elevation,
    heading: args.pos.heading,
    position: { x: args.pos.x, y: args.pos.y, z: args.pos.z },
    section: args.section ?? args.pos.section,
  };
}

function buildPyroCues(positions: ShowPosition[]): PyroCue[] {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const cues: PyroCue[] = [];

  // ── Movement 1 · Build-up (t=0..30s) ──────────────────────────────
  // Alternate low SOUTH/NORTH every 1.5s, gerb/fountain. Slow comets
  // every 4s on high arcs.
  for (let i = 0; i < 16; i++) {
    const t = 1.0 + i * 1.5;
    const sideS = byId.get(`low-s-${i.toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `m1-low-s-${i}`,
        time: t,
        pos: sideS,
        module: 0,
        channel: i,
        effectId: 'gerb-3m-30s',
        caliber: 25,
        elevation: 90,
        section: 'm1-build',
      }),
    );
    const sideN = byId.get(`low-n-${i.toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `m1-low-n-${i}`,
        time: t + 0.75,
        pos: sideN,
        module: 1,
        channel: i,
        effectId: 'fountain-5m-15s',
        caliber: 25,
        elevation: 90,
        section: 'm1-build',
      }),
    );
  }
  // Comets: 4 each side, 4s apart, t=2..30s
  for (let i = 0; i < COMETS / 2; i++) {
    const t = 2 + i * 7;
    const ps = byId.get(`high-s-${(i * 4).toString().padStart(2, '0')}`)!;
    const pn = byId.get(`high-n-${(i * 4).toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `m1-comet-s-${i}`,
        time: t,
        pos: ps,
        module: 2,
        channel: i * 4,
        effectId: 'comet-cross-gold',
        caliber: 40,
        elevation: 75,
        section: 'm1-comets',
      }),
      cue({
        id: `m1-comet-n-${i}`,
        time: t + 0.5,
        pos: pn,
        module: 3,
        channel: i * 4,
        effectId: 'comet-cross-gold',
        caliber: 40,
        elevation: 75,
        section: 'm1-comets',
      }),
    );
  }

  // ── Movement 2 · Anthem (t=30..60s) ───────────────────────────────
  // Synchronized high shells in arc — pairs S/N simultaneously,
  // every 2s, full 16 channels each side.
  for (let i = 0; i < 16; i++) {
    const t = 30.5 + i * 1.75;
    const ps = byId.get(`high-s-${i.toString().padStart(2, '0')}`)!;
    const pn = byId.get(`high-n-${i.toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `m2-high-s-${i}`,
        time: t,
        pos: ps,
        module: 2,
        channel: i,
        effectId: 'shell-75-chrysanthemum-blue',
        caliber: 75,
        elevation: 90,
        section: 'm2-anthem',
      }),
      cue({
        id: `m2-high-n-${i}`,
        time: t,
        pos: pn,
        module: 3,
        channel: i,
        effectId: 'shell-75-chrysanthemum-gold',
        caliber: 75,
        elevation: 90,
        section: 'm2-anthem',
      }),
    );
  }

  // ── Movement 3 · Finale (t=60..90s) ───────────────────────────────
  // Full barrage: every 1s a wave that includes 4 lows + 4 highs.
  // 30 waves * (4+4) = 240 cues — but cap at unique channel reuse window.
  // Simpler: 16 alternating waves at 1.875s spacing, each wave fires
  // 2 lows + 2 highs across both sides.
  for (let i = 0; i < 16; i++) {
    const t = 60.5 + i * 1.875;
    const idxLowS = i % 16;
    const idxLowN = (i + 8) % 16;
    const idxHigh = i % 16;
    cues.push(
      cue({
        id: `m3-lo-s-${i}`,
        time: t,
        pos: byId.get(`low-s-${idxLowS.toString().padStart(2, '0')}`)!,
        module: 0,
        channel: idxLowS,
        effectId: 'mine-silver-2s',
        caliber: 50,
        elevation: 90,
        section: 'm3-finale',
      }),
      cue({
        id: `m3-lo-n-${i}`,
        time: t + 0.1,
        pos: byId.get(`low-n-${idxLowN.toString().padStart(2, '0')}`)!,
        module: 1,
        channel: idxLowN,
        effectId: 'mine-silver-2s',
        caliber: 50,
        elevation: 90,
        section: 'm3-finale',
      }),
      cue({
        id: `m3-hi-s-${i}`,
        time: t + 0.25,
        pos: byId.get(`high-s-${idxHigh.toString().padStart(2, '0')}`)!,
        module: 2,
        channel: idxHigh,
        effectId: 'shell-75-peony-red',
        caliber: 75,
        elevation: 90,
        section: 'm3-finale',
      }),
      cue({
        id: `m3-hi-n-${i}`,
        time: t + 0.25,
        pos: byId.get(`high-n-${idxHigh.toString().padStart(2, '0')}`)!,
        module: 3,
        channel: idxHigh,
        effectId: 'shell-75-peony-gold',
        caliber: 75,
        elevation: 90,
        section: 'm3-finale',
      }),
    );
  }

  return cues;
}

/** Build the Libertadores ShowPlan. Pure function — same input, same output. */
export function createLibertadoresShowPlan(): ShowPlan {
  const sp = createEmptyShowPlan();
  const positions = buildPositions();
  const pyroCues = buildPyroCues(positions);

  sp.metadata = {
    ...sp.metadata,
    id: 'libertadores-golden-show',
    name: SHOW_NAME,
    venue: SHOW_VENUE,
    gps: { lat: -22.91219, lng: -43.23021, alt: 12 }, // referencial Maracanã
    duration: SHOW_DURATION_S,
    version: 1,
    author: 'FXKONTROL Reference',
    notes:
      'Golden show Fase 1. 32 highs + 32 lows + 8 cometas, 4 módulos FXK16, 90s, 3 movimentos. ' +
      'Reference para validar simulação=execução=realidade.',
  };
  sp.positions = positions;
  sp.pyroCues = pyroCues;
  sp.hardwareConfig = {
    modules: buildModules(),
    muxChannels: 8,
    shiftRegisterBits: 8,
    totalRelays: 64,
  };
  // Tighten safety for stadium context.
  sp.safetyConstraints = {
    ...sp.safetyConstraints,
    nfpaMinDistance: 70,    // 75mm shells → 70m exclusion (NFPA 1123 baseline)
    maxWindSpeed: 12,       // m/s (UK/BR pyro guidance)
    maxCaliper: 75,
    requireContinuityCheck: true,
    requireDualKey: true,   // stadium = dual key required
  };

  return sp;
}

/** Quick stats for tests + UI surfaces. Pure read. */
export interface LibertadoresSummary {
  totalCues: number;
  lowCount: number;
  highCount: number;
  cometCount: number;
  modules: number;
  duration: number;
  positions: number;
}

export function summarizeLibertadores(sp: ShowPlan): LibertadoresSummary {
  return {
    totalCues: sp.pyroCues.length,
    lowCount: sp.pyroCues.filter((c) => c.caliber <= 50).length,
    highCount: sp.pyroCues.filter((c) => c.caliber >= 75).length,
    cometCount: sp.pyroCues.filter((c) => c.effectId.includes('comet')).length,
    modules: sp.hardwareConfig.modules.length,
    duration: sp.metadata.duration,
    positions: sp.positions.length,
  };
}

export const LIBERTADORES_TARGETS = {
  POINTS_LOW,
  POINTS_HIGH,
  COMETS,
  DURATION_S: SHOW_DURATION_S,
  MODULES: 4,
  CHANNELS_TOTAL: 64,
} as const;
