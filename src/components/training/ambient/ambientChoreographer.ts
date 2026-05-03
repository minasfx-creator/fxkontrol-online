/**
 * Training v2.1 — Ambient choreographer.
 *
 * Pure scheduler emitting "ambient hints" used by AmbientNPCLayer
 * (e.g. roadie carries case A→B, dancer paces, walkie crackles)
 * + a parallel **microevent** scheduler (chatter, glance, drop-tool,
 * prop-flash) tick-driven with per-event cooldowns and density caps.
 *
 * Pure functions only — no React, no THREE, no timers (tick-driven).
 */

import type { AmbientPreset } from '../missions/types';

export interface AmbientHint {
  id: string;
  npcId: string;
  /** Path waypoints in world space. */
  waypoints: [number, number, number][];
  /** ms — duration of one full traversal. */
  durationMs: number;
  /** Idle gesture override. */
  gesture?: 'walk' | 'stand-check' | 'crouch';
  /** Optional radio chatter line. */
  chatter?: string;
}

const HINT_BANK: AmbientHint[] = [
  {
    id: 'roadie-case-AB',
    npcId: 'roadie-veterano',
    waypoints: [[-12, 0.3, 6], [-2, 0.3, 6], [-2, 0.3, -2], [-12, 0.3, -2]],
    durationMs: 24000,
    gesture: 'walk',
  },
  {
    id: 'dancer-pace',
    npcId: 'dancarino-passagem',
    waypoints: [[-4, 0.9, -3], [4, 0.9, -3]],
    durationMs: 8000,
    gesture: 'walk',
  },
  {
    id: 'client-check-watch',
    npcId: 'cliente-corporativo',
    waypoints: [[8, 0.3, 2], [8, 0.3, 2]],
    durationMs: 5000,
    gesture: 'stand-check',
    chatter: 'Quanto falta?',
  },
  {
    id: 'dj-soundcheck',
    npcId: 'dj-residente',
    waypoints: [[0, 0.9, -6], [0, 0.9, -6]],
    durationMs: 30000,
    gesture: 'stand-check',
    chatter: 'Check, check… 1, 2.',
  },
  {
    id: 'walkie-radio-chatter',
    npcId: 'eletricista-radio',
    waypoints: [[0, -10, 0]],
    durationMs: 12000,
    chatter: '*kkkk* tô subindo a fase agora *kkkk*',
  },
];

const PRESET_DENSITY: Record<AmbientPreset, number> = {
  calm: 1,
  busy: 3,
  frantic: 5,
};

export interface AmbientChoreographerOpts {
  preset: AmbientPreset;
  /** Optional id allow-list (if omitted, draws from full bank). */
  allow?: string[];
  /** Deterministic seed for tests. */
  seed?: number;
}

export function pickAmbientHints(opts: AmbientChoreographerOpts): AmbientHint[] {
  const target = PRESET_DENSITY[opts.preset];
  const pool = opts.allow ? HINT_BANK.filter((h) => opts.allow!.includes(h.id)) : HINT_BANK.slice();
  let i = opts.seed ?? 0;
  const out: AmbientHint[] = [];
  while (out.length < target && pool.length) {
    const idx = i % pool.length;
    out.push(pool.splice(idx, 1)[0]);
    i += 7;
  }
  return out;
}

/** Linear interpolation across waypoints; loops. */
export function sampleHintPosition(hint: AmbientHint, tMs: number): [number, number, number] {
  if (hint.waypoints.length === 0) return [0, 0, 0];
  if (hint.waypoints.length === 1) return hint.waypoints[0];
  const cyclic = [...hint.waypoints, hint.waypoints[0]];
  const segDur = hint.durationMs / (cyclic.length - 1);
  const cyclePos = (tMs % hint.durationMs) / segDur;
  const segIdx = Math.floor(cyclePos);
  const segT = cyclePos - segIdx;
  const a = cyclic[segIdx];
  const b = cyclic[Math.min(segIdx + 1, cyclic.length - 1)];
  return [
    a[0] + (b[0] - a[0]) * segT,
    a[1] + (b[1] - a[1]) * segT,
    a[2] + (b[2] - a[2]) * segT,
  ];
}

// ─────────────────────────────────────────────────────────────────
// Microevent scheduler — parallel ambient flavour
// ─────────────────────────────────────────────────────────────────

export type MicroEventKind =
  | 'chatter'      // NPC says a short flavour line
  | 'glance'       // NPC briefly looks at stage / camera
  | 'gesture'      // NPC does a one-shot gesture (point, wave, scratch)
  | 'drop-tool'    // NPC fumbles a tool — clack SFX
  | 'walkie-pop'   // walkie LED flicker + static blip
  | 'cough';       // ambient cough / clear throat

export interface MicroEvent {
  /** Unique runtime id (id + count). */
  id: string;
  kind: MicroEventKind;
  /** NPC id this event targets (may be ambient or scripted). */
  npcId: string;
  /** ms timestamp when emitted (relative to scheduler clock). */
  emittedAtMs: number;
  /** ms duration the consumer should hold this event "live". */
  durationMs: number;
  /** Optional payload. */
  text?: string;
  worldPos?: [number, number, number];
}

interface MicroEventDef {
  kind: MicroEventKind;
  /** Weight relative to other defs. */
  weight: number;
  /** Min time between two emissions of THIS def, ms. */
  cooldownMs: number;
  /** Default visible duration. */
  durationMs: number;
  /** Sample text bank. */
  texts?: string[];
  /** NPC pool — picked at random; falls back to scheduler.npcPool. */
  npcPool?: string[];
}

const MICRO_BANK: MicroEventDef[] = [
  {
    kind: 'chatter',
    weight: 4,
    cooldownMs: 7000,
    durationMs: 2400,
    texts: [
      'Cabo do canal 4, alguém?',
      'Tá faltando fita aqui.',
      'Já mandaram o rider novo.',
      'Vou descer pegar o multímetro.',
      'Onde tá o gerente de palco?',
    ],
    npcPool: ['roadie-veterano', 'sound-tech-junior', 'eletricista-radio'],
  },
  {
    kind: 'walkie-pop',
    weight: 5,
    cooldownMs: 4500,
    durationMs: 600,
    texts: [
      '*kkk* copiado *kkk*',
      '*kkk* posição segura *kkk*',
      '*kkk* aguardando autorização *kkk*',
    ],
    npcPool: ['eletricista-radio', 'security-female', 'roadie-veterano'],
  },
  {
    kind: 'glance',
    weight: 3,
    cooldownMs: 5000,
    durationMs: 1400,
  },
  {
    kind: 'gesture',
    weight: 2,
    cooldownMs: 6000,
    durationMs: 1800,
  },
  {
    kind: 'drop-tool',
    weight: 1,
    cooldownMs: 18000,
    durationMs: 700,
    npcPool: ['roadie-veterano', 'sound-tech-junior'],
  },
  {
    kind: 'cough',
    weight: 1,
    cooldownMs: 12000,
    durationMs: 800,
    npcPool: ['cliente-corporativo', 'bombeiro-fiscal', 'dancarino-passagem'],
  },
];

const PRESET_RATE_HZ: Record<AmbientPreset, number> = {
  // expected microevents per second across the whole scene
  calm:    0.15,
  busy:    0.5,
  frantic: 1.2,
};

const PRESET_MAX_LIVE: Record<AmbientPreset, number> = {
  calm: 2,
  busy: 4,
  frantic: 7,
};

export interface MicroEventSchedulerOpts {
  preset: AmbientPreset;
  /** Pool of NPCs eligible for events that don't pin one. */
  npcPool?: string[];
  /** Deterministic seed for tests. */
  seed?: number;
}

export interface MicroEventSchedulerState {
  preset: AmbientPreset;
  npcPool: string[];
  rng: () => number;
  lastEmitByKind: Record<string, number>;
  liveCount: number;
  emitCounter: number;
  ratePerMs: number;
  maxLive: number;
}

/** Mulberry32 — deterministic, fast, no deps. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMicroEventScheduler(opts: MicroEventSchedulerOpts): MicroEventSchedulerState {
  return {
    preset: opts.preset,
    npcPool: opts.npcPool ?? [],
    rng: mulberry32(opts.seed ?? 1),
    lastEmitByKind: Object.create(null),
    liveCount: 0,
    emitCounter: 0,
    ratePerMs: PRESET_RATE_HZ[opts.preset] / 1000,
    maxLive: PRESET_MAX_LIVE[opts.preset],
  };
}

/** Mark one event as resolved (frees a live slot). */
export function resolveMicroEvent(state: MicroEventSchedulerState): void {
  if (state.liveCount > 0) state.liveCount -= 1;
}

/**
 * Tick the scheduler. Pure: returns 0..N new events, mutates only
 * the explicit state passed in.
 *
 * - dtMs: elapsed ms since last tick (clamped 0..500 internally).
 * - nowMs: scheduler-relative current time in ms.
 */
export function tickMicroEvents(
  state: MicroEventSchedulerState,
  dtMs: number,
  nowMs: number,
): MicroEvent[] {
  const dt = Math.max(0, Math.min(500, dtMs));
  if (state.liveCount >= state.maxLive) return [];
  const expected = state.ratePerMs * dt;
  // Probability of at least one event this tick.
  const p = 1 - Math.exp(-expected);
  if (state.rng() > p) return [];

  // Weighted pick respecting cooldowns.
  const eligible = MICRO_BANK.filter((d) => {
    const last = state.lastEmitByKind[d.kind] ?? -Infinity;
    return nowMs - last >= d.cooldownMs;
  });
  if (eligible.length === 0) return [];

  const totalW = eligible.reduce((s, d) => s + d.weight, 0);
  let pick = state.rng() * totalW;
  let chosen = eligible[0];
  for (const d of eligible) {
    pick -= d.weight;
    if (pick <= 0) { chosen = d; break; }
  }

  // NPC choice
  const pool = (chosen.npcPool && chosen.npcPool.length > 0) ? chosen.npcPool : state.npcPool;
  if (pool.length === 0) return [];
  const npcId = pool[Math.floor(state.rng() * pool.length) % pool.length];

  const text = chosen.texts && chosen.texts.length
    ? chosen.texts[Math.floor(state.rng() * chosen.texts.length) % chosen.texts.length]
    : undefined;

  state.lastEmitByKind[chosen.kind] = nowMs;
  state.liveCount += 1;
  state.emitCounter += 1;

  const ev: MicroEvent = {
    id: `${chosen.kind}-${state.emitCounter}`,
    kind: chosen.kind,
    npcId,
    emittedAtMs: nowMs,
    durationMs: chosen.durationMs,
    text,
  };
  return [ev];
}
