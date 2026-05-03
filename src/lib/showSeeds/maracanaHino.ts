/**
 * ─── Show Maracanã · Hino Nacional · Golden Seed (Phase 1) ──────────
 *
 * Second canonical reference show used to prove the seed → verification →
 * simulationDryRun → canonicalToEnginePlan pipeline is **generic**, not
 * coupled to the Libertadores layout.
 *
 * Concept: ~60s solenidade durante a execução do Hino Nacional Brasileiro.
 *  - 2 × FXK16 modules (32 channels total) — single arc behind the field.
 *  - Soft build of low fountains (gerbs) under the verses,
 *    high gold/green peony shells on the chorus apex,
 *    a single closing volley.
 *
 * Hardware: 2 × FXK16
 *  - module 0 ch 0..15 → low effects (gerbs/fountains) — central arc
 *  - module 1 ch 0..15 → high shells 50mm — central arc (offset +5m z)
 *
 * Honesty layer: pure deterministic — zero `Math.random()`, zero IO.
 * Same input ⇒ same output. Validated by the existing Phase 1 exit
 * criterion (`verificationEngine.canExport(sp) === true`).
 */

import type {
  ShowPlan,
  PyroCue,
  ShowPosition,
  HardwareModuleConfig,
} from '@/core/showplan/ShowPlan';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';

const SHOW_NAME = 'Maracanã · Hino Nacional · Golden Show';
const SHOW_VENUE = 'Estádio referencial 75k (Maracanã-style) — campo central';
const SHOW_DURATION_S = 60;
const ARC_HALF_WIDTH_M = 30;
const POINTS_LOW = 16;
const POINTS_HIGH = 16;

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
    mk(0, 'Low CENTRAL (gerbs/fountains)'),
    mk(1, 'High CENTRAL (50mm shells)'),
  ];
}

function arc(
  prefix: string,
  count: number,
  z: number,
  moduleId: string,
  channelStart: number,
  section: string,
): ShowPosition[] {
  const out: ShowPosition[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = -ARC_HALF_WIDTH_M + t * (2 * ARC_HALF_WIDTH_M);
    out.push({
      id: `${prefix}-${i.toString().padStart(2, '0')}`,
      name: `${prefix.toUpperCase()} #${i + 1}`,
      type: 'pyro',
      x,
      y: 0,
      z,
      heading: 0,
      pitch: 90,
      section,
      moduleId,
      channelStart: channelStart + i,
    });
  }
  return out;
}

function buildPositions(): ShowPosition[] {
  return [
    ...arc('low-c', 16, -20, 'fxk16-0', 0, 'low-central'),
    ...arc('high-c', 16, -25, 'fxk16-1', 0, 'high-central'),
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
  section?: string;
}): PyroCue {
  return {
    id: args.id,
    time: Math.round(args.time * 1000) / 1000,
    positionId: args.pos.id,
    module: args.module,
    channel: args.channel,
    effectId: args.effectId,
    fuseDelay: 0,
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

  // ── Verses 1-2 (t=0..30s) — gerbs swelling left→right, 2s spacing
  for (let i = 0; i < 16; i++) {
    const t = 1.0 + i * 1.75;
    const p = byId.get(`low-c-${i.toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `verse-low-${i}`,
        time: t,
        pos: p,
        module: 0,
        channel: i,
        effectId: 'gerb-3m-30s',
        caliber: 25,
        elevation: 90,
        section: 'verses',
      }),
    );
  }

  // ── Chorus apex (t=30..50s) — paired high shells from center outward,
  //     gold + green alternating (national colors). 16 shells, 1.25s spacing.
  for (let i = 0; i < 16; i++) {
    const t = 30.5 + i * 1.25;
    const p = byId.get(`high-c-${i.toString().padStart(2, '0')}`)!;
    const isGreen = i % 2 === 0;
    cues.push(
      cue({
        id: `chorus-hi-${i}`,
        time: t,
        pos: p,
        module: 1,
        channel: i,
        effectId: isGreen
          ? 'shell-50-peony-green'
          : 'shell-50-peony-gold',
        caliber: 50,
        elevation: 90,
        section: 'chorus',
      }),
    );
  }

  // ── Closing volley (t=55..58s) — 8 lows mid-arc as silver mines.
  // Reuses lows 4..11 (channel reuse window: gerb fired at t≈8..21,
  // mine at t≈55+, gap ≫ 1s → safe).
  for (let i = 0; i < 8; i++) {
    const idx = 4 + i;
    const t = 55.0 + i * 0.375;
    const p = byId.get(`low-c-${idx.toString().padStart(2, '0')}`)!;
    cues.push(
      cue({
        id: `closing-mine-${i}`,
        time: t,
        pos: p,
        module: 0,
        channel: idx,
        effectId: 'mine-silver-2s',
        caliber: 50,
        elevation: 90,
        section: 'closing',
      }),
    );
  }

  return cues;
}

/** Build the Maracanã · Hino Nacional ShowPlan. Pure function. */
export function createMaracanaHinoShowPlan(): ShowPlan {
  const sp = createEmptyShowPlan();
  const positions = buildPositions();
  const pyroCues = buildPyroCues(positions);

  sp.metadata = {
    ...sp.metadata,
    id: 'maracana-hino-golden-show',
    name: SHOW_NAME,
    venue: SHOW_VENUE,
    gps: { lat: -22.91219, lng: -43.23021, alt: 12 },
    duration: SHOW_DURATION_S,
    version: 1,
    author: 'FXKONTROL Reference',
    notes:
      'Golden show #2 (Fase 1). 16 highs + 16 lows + 8 closing mines, 2 módulos FXK16, 60s, ' +
      '3 movimentos (versos / refrão / encerramento). Validador da generalidade da pipeline.',
  };
  sp.positions = positions;
  sp.pyroCues = pyroCues;
  sp.hardwareConfig = {
    modules: buildModules(),
    muxChannels: 8,
    shiftRegisterBits: 8,
    totalRelays: 32,
  };
  sp.safetyConstraints = {
    ...sp.safetyConstraints,
    nfpaMinDistance: 50,    // 50mm shells → 50m exclusion (NFPA 1123)
    maxWindSpeed: 12,
    maxCaliper: 50,
    requireContinuityCheck: true,
    requireDualKey: true,
  };

  return sp;
}

export interface MaracanaHinoSummary {
  totalCues: number;
  lowCount: number;
  highCount: number;
  modules: number;
  duration: number;
  positions: number;
}

export function summarizeMaracanaHino(sp: ShowPlan): MaracanaHinoSummary {
  return {
    totalCues: sp.pyroCues.length,
    lowCount: sp.pyroCues.filter((c) => c.caliber <= 50 && !c.effectId.startsWith('shell')).length,
    highCount: sp.pyroCues.filter((c) => c.effectId.startsWith('shell')).length,
    modules: sp.hardwareConfig.modules.length,
    duration: sp.metadata.duration,
    positions: sp.positions.length,
  };
}

export const MARACANA_HINO_TARGETS = {
  POINTS_LOW,
  POINTS_HIGH,
  CLOSING_MINES: 8,
  DURATION_S: SHOW_DURATION_S,
  MODULES: 2,
  CHANNELS_TOTAL: 32,
} as const;
